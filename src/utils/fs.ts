import fs from "fs/promises";
import glob from "glob";
import { createRequire } from "node:module";
import path from "path";
import { Config } from "../cli.js";
import { aiIntlFileName } from "../costants/aiFileName.js";
import { validateAllKeysMatch } from "./diff.js";

type StrcutMissingTranslations = {
  file: string;
  locale: string;
};

// lstat is used because this is also used to check if a symlink file exists
export const fileExists = (filePath: string) =>
  fs.lstat(filePath).then(
    () => true,
    () => false
  );

export const readConfigFile = async (filePath: string) => {
  const doesConfigExists = await fileExists(filePath);
  if (!doesConfigExists) {
    throw new Error(
      "ai-intl.config.js not found. Please run `ai-intl generate` to create one."
    );
  }

  return loadJson(filePath);
};

export const loadJson = (filePath: string) => {
  const require = createRequire(import.meta.url);
  return require(path.resolve(filePath));
};

export const findNewTranslationsFile = async () => {
  const { defaultLocale, locales, translationsPath } = (await readConfigFile(
    aiIntlFileName
  )) as Config;

  const translationsFolder = glob.sync(
    `${translationsPath}/${defaultLocale}/*.json`
  );
  const translationName = glob.sync(
    `${translationsPath}/**/${defaultLocale}*.json`
  );

  const files = [...translationsFolder, ...translationName];

  const missingTranslations = [] as StrcutMissingTranslations[];

  for (const file of files) {
    for (const locale of locales) {
      const localeFile = file.replace(defaultLocale, locale);
      const doesTranslationForLocaleFileExists = await fileExists(localeFile);

      if (doesTranslationForLocaleFileExists) {
        const originalJson = loadJson(file);
        const translatedJson = loadJson(localeFile);

        const isMatching = validateAllKeysMatch({
          originalJson,
          generatedJson: translatedJson,
        });

        if (!isMatching) {
          missingTranslations.push({
            file,
            locale,
          });
        }
      } else {
        missingTranslations.push({
          file,
          locale,
        });
      }
    }
  }

  if (missingTranslations.length === 0) {
    return [];
  }

  return missingTranslations;
};
