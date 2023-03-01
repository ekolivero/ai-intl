import { Task } from "tasuku";
import fsExtra from "fs-extra";
import { Configuration, OpenAIApi } from "openai";
import { getConfig } from "./config.js";
import { getDiff, validateAllKeysMatch } from "./diff.js";
import { fileExists, loadJson } from "./fs.js";

const { outputJson } = fsExtra;

const sanitizeMessage = (message: string) =>
  message
    .trim()
    .replace(/[\n\r]/g, "")
    .replace(/(\w)\.$/, "$1");

const promptTemplate = (locale: string) => `
  "Translate only the value of the key-value json file in input, the translated values must match ${locale} locale, if there are any job titles or industry-specific terms that need to be translated accurately please translate, the translations will be used for a ${locale} locale website, keep the same key of the json without translating it, then return the JSON\n":`;

type TranslateProps = {
  file: string;
  locale: string;
  defaultLocale: string;
  task: Task;
};

const combineTranslations = (original: any, generated: any) => {
  const result = {} as any;
  let keys = [
    ...new Set([...Object.keys(original), ...Object.keys(generated)]),
  ];
  for (let k of keys) {
    if (original[k] && generated[k] && typeof original[k] === "object") {
      result[k] = combineTranslations(original[k], generated[k]);
    } else if (original[k] === generated[k]) {
      result[k] = original[k];
    } else {
      result[k] =
        original[k] && generated[k] ? "" : original[k] || generated[k];
    }
  }
  return result;
};

const callOpenAiAndParseResponse = async (prompt: string): Promise<JSON> => {
  const { OPENAI_KEY: apiKey } = await getConfig();
  const OPENAI_KEY =
    process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? apiKey;

  const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }));

  if (prompt.length > 8000) {
    throw new Error("The translations file is too large for the OpenAI API.");
  }

  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 3000,
      stream: false,
    });

    if (!completion.data.choices[0].text) {
      throw new Error(
        "The OpenAI API returned no results. Please try again later."
      );
    }

    try {
      const generatedJson = JSON.parse(
        completion.data.choices[0].text ?? "{}"
      ) as JSON;
      return generatedJson;
    } catch (error) {
      throw new Error("The OpenAI API returned invalid JSON.");
    }
  } catch (error) {
    const errorAsAny = error as any;
    if (errorAsAny.code === "ENOTFOUND") {
      throw new Error(
        `Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall}). Are you connected to the internet?`
      );
    }

    errorAsAny.message = `OpenAI API Error: ${errorAsAny.message} - ${errorAsAny.response.statusText}`;
    throw errorAsAny;
  }
};

export const translate = async ({
  file,
  locale,
  defaultLocale,
  task,
}: TranslateProps) => {
  return task(
    `Translating ${file.split("/").pop()}`,
    async ({ setTitle, setStatus }) => {
      const fileName = file.split("/").pop();
      setTitle(`Preparing translation for ${fileName}...`);

      const jsonFile = loadJson(file) as JSON;

      const translationExists = await fileExists(
        file?.replace(defaultLocale, locale) ?? ""
      );

      let generatedJson: JSON = {} as JSON;

      if (translationExists) {
        const translationFile = loadJson(
          file?.replace(defaultLocale, locale) ?? ""
        ) as any;

        const diff = getDiff({
          originalJson: jsonFile,
          generatedJson: translationFile,
        });

        if (!diff) {
          return;
        }

        const prompt = `${promptTemplate(locale)}\n${sanitizeMessage(
          JSON.stringify(diff)
        )}`;

        const diffGenerateTranslation = (await callOpenAiAndParseResponse(
          prompt
        )) as any;

        generatedJson = combineTranslations(
          translationFile,
          diffGenerateTranslation
        );
      } else {
        const prompt = `${promptTemplate(locale)}\n${sanitizeMessage(
          JSON.stringify(jsonFile)
        )}`;
        generatedJson = await callOpenAiAndParseResponse(prompt);
      }

      const isMatching = validateAllKeysMatch({
        generatedJson,
        originalJson: jsonFile,
      });

      if (!isMatching) {
        throw new Error(
          `The generated translation for ${fileName} doesn't match the original one.`
        );
      }

      setTitle(`Storing translation for ${fileName}...`);
      await outputJson(file.replace(defaultLocale, locale), generatedJson, {
        spaces: 2,
      });

      setTitle(`Successfully stored translation for ${fileName}...`);
      setStatus("success");

      return "Success";
    }
  );
};
