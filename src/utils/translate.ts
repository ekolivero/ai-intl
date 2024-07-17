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

const containsPlaceholders = (str: string) => /\{\{\s*\w+\s*\}\}/.test(str);

function createTranslationSchema(
  englishTranslations: Record<string, any>
): z.ZodType<any> {
  const schemaShape: Record<string, z.ZodType<any>> = {};

  for (const [key, value] of Object.entries(englishTranslations)) {
    if (typeof value === "string") {
      const baseSchema = z.string({
        description: value,
      });

      if (containsPlaceholders(value)) {
        schemaShape[key] = baseSchema.refine(
          (val) => containsPlaceholders(val),
          {
            message: `The '${key}' translation must contain placeholders matching the original: "${value}"`,
          }
        );
      } else {
        schemaShape[key] = baseSchema;
      }
    } else if (typeof value === "object" && value !== null) {
      // Recursively create schema for nested objects
      schemaShape[key] = createTranslationSchema(value);
    }
  }

  return z.object(schemaShape);
}

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
  translations: any,
  defaultLocale: string,
  customPromt: string,
): Promise<any> => {
  const { OPENAI_KEY: apiKey, MODEL: model } = await getConfig();
  const OPENAI_KEY = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? apiKey;

  const openai = createOpenAI({
    apiKey: OPENAI_KEY,
  });

  const zodSchema = createTranslationSchema(translations);
  
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: zodSchema,
    system: dedent`
      Pay extra attention to the placeholders.
    `,
    prompt: dedent`
      ${customPromt}
      Always translate the JSON schema to the following locale: ${locale}.
    `,
  });

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

      const diffGenerateTranslation = (await callOpenAiAndParseResponse(locale, diff, defaultLocale, customPrompt)) as any;

      generatedJson = combineTranslations(translationFile, diffGenerateTranslation);
    } else {

      const diffGenerateTranslation = (await callOpenAiAndParseResponse(locale, jsonFile, defaultLocale, customPrompt)) as any;

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
