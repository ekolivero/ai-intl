import { Task } from "tasuku";
import fsExtra from "fs-extra";
import { getConfig } from "./config.js";
import { getDiff, validateAllKeysMatch } from "./diff.js";
import { fileExists, loadJson, loadMarkdown } from "./fs.js";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import dedent from "dedent";

const { outputJson } = fsExtra;

const containsPlaceholders = (str: string) => /\{.*?\}/.test(str);

function createTranslationSchema(englishTranslations: Record<string, string>) {
  const schemaShape: Record<string, z.ZodType<string>> = {};

  for (const [key, value] of Object.entries(englishTranslations)) {
    const baseSchema = z.string({
      description: value,
    });

    if (containsPlaceholders(value)) {
      schemaShape[key] = baseSchema.refine((val) => containsPlaceholders(val), {
        message: `The '${key}' translation must contain placeholders matching the original: "${value}"`,
      });
    } else {
      schemaShape[key] = baseSchema;
    }
  }

  return z.object(schemaShape);
}


const sanitizeMessage = (message: string) =>
  message
    .trim()
    .replace(/[\n\r]/g, "")
    .replace(/(\w)\.$/, "$1");

type TranslateProps = {
  file: string;
  locale: string;
  defaultLocale: string;
  task: Task;
  customPrompt?: string;
};

const combineTranslations = (original: any, generated: any) => {
  const result = {} as any;
  let keys = [...new Set([...Object.keys(original), ...Object.keys(generated)])];
  for (let k of keys) {
    if (original[k] && generated[k] && typeof original[k] === "object") {
      result[k] = combineTranslations(original[k], generated[k]);
    } else if (original[k] === generated[k]) {
      result[k] = original[k];
    } else {
      result[k] = original[k] && generated[k] ? "" : original[k] || generated[k];
    }
  }
  return result;
};

const callOpenAiAndParseResponse = async (
  locale: string,
  sanitizedJson: string,
  defaultLocale: string,
  customPromt: string,
): Promise<any> => {
  const { OPENAI_KEY: apiKey, MODEL: model } = await getConfig();
  const OPENAI_KEY = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? apiKey;

  const openai = createOpenAI({
    apiKey: OPENAI_KEY,
  });

  console.log(customPromt)

  const promptLocale = locale.toUpperCase();

  const zodSchema = createTranslationSchema(JSON.parse(sanitizedJson));
  
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: zodSchema,
    system: dedent`
      Pay extra attention to the placeholders.
    `,
    prompt: dedent`
      ${customPromt}
      Always the following JSON schema to ${promptLocale}.
    `,
  });

  console.log(object)

  return object
};

export const translate = async ({ file, locale, defaultLocale, task }: TranslateProps) => {
  return task(`Translating ${file.split("/").pop()}`, async ({ setTitle, setStatus }) => {
    const fileName = file.split("/").pop();
    setTitle(`Preparing translation for ${fileName}...`);

    const promptExists = await fileExists(file.replace(".json", ".md"))

    const customPrompt = promptExists ? await loadMarkdown(file.replace(".json", ".md")) : "";

    const jsonFile = loadJson(file) as JSON;

    const translationExists = await fileExists(file?.replace(defaultLocale, locale) ?? "");

    let generatedJson: JSON = {} as JSON;

    if (translationExists) {
      const translationFile = loadJson(file?.replace(defaultLocale, locale) ?? "") as any;

      const diff = getDiff({
        originalJson: jsonFile,
        generatedJson: translationFile,
      });

      if (!diff) {
        return;
      }

      const sanitizedJson = sanitizeMessage(JSON.stringify(diff));

      const diffGenerateTranslation = (await callOpenAiAndParseResponse(locale, sanitizedJson, defaultLocale, customPrompt)) as any;

      generatedJson = combineTranslations(translationFile, diffGenerateTranslation);
    } else {
      const sanitizedJson = sanitizeMessage(JSON.stringify(jsonFile));

      const diffGenerateTranslation = (await callOpenAiAndParseResponse(locale, sanitizedJson, defaultLocale, customPrompt)) as any;

      generatedJson = diffGenerateTranslation;
    }

    const isMatching = validateAllKeysMatch({
      generatedJson,
      originalJson: jsonFile,
    });

    if (!isMatching) {
      throw new Error(`The generated translation for ${fileName} doesn't match the original one.`);
    }

    setTitle(`Storing translation for ${fileName}...`);
    await outputJson(file.replace(defaultLocale, locale), generatedJson, {
      spaces: 2,
    });

    setTitle(`Successfully stored translation for ${fileName}...`);
    setStatus("success");

    return "Success";
  });
};
