import { cli } from "cleye";
import { description, version } from "../package.json";
import hookCommand, { isCalledFromGitHook } from "./commands/hook.js";
import configCommand from "./commands/config.js";
import translateCli from "./commands/translateCli.js";
import generateCommand from "./commands/generate.js";
import { readConfigFile } from "./utils/fs.js";
import { getStagedDiff } from "./utils/git.js";
import { aiIntlFileName } from "./costants/aiFileName.js";
import task from "tasuku";
import { translate } from "./utils/translate.js";
import { green } from "kolorist";
import { execa } from "execa";
import pkg from "fs-extra";
const { pathExistsSync } = pkg;

type StrcutMissingTranslations = {
  file: string;
  locale: string;
};

export type Config = {
  translationsPath: string;
  defaultLocale: string;
  locales: string[];
};

type DiffStruct = {
  files: string[];
  diff: string;
};

cli(
  {
    name: "ai-intl",
    version,
    description,
    flags: {
      apiKey: {
        type: String,
        description: "OpenAI API Key",
      },
    },

    commands: [configCommand, hookCommand, translateCli, generateCommand],

    help: {
      description,
    },
  },
  async (argv) => {
    const {
      defaultLocale,
      locales,
      translationsPath: defaultTranslationsPath,
    } = (await readConfigFile(aiIntlFileName)) as Config;

    let stagedDiff: DiffStruct | undefined;

    if (pathExistsSync(`${defaultTranslationsPath}/${defaultLocale}`)) {
      const pathToSearchDiff = `${defaultTranslationsPath}/${defaultLocale}`;
      stagedDiff = await getStagedDiff(pathToSearchDiff);
    } else {
      const pathToSearchDiff = defaultTranslationsPath;
      stagedDiff = await getStagedDiff(pathToSearchDiff);
    }

    if (!stagedDiff) {
      console.log(
        green("✔"),
        "Your translations are up to date, continue committing..."
      );
      return;
    }

    let missingTranslationsToGenerate: StrcutMissingTranslations[] = [];

    for (const file of stagedDiff.files) {
      for (const locale of locales) {
        missingTranslationsToGenerate.push({
          file,
          locale,
        });
      }
    }

    const translationTasks = await task.group(
      (task) =>
        missingTranslationsToGenerate.map(({ file, locale }) =>
          task(
            `Translating ${file} to ${locale}`,
            async ({ task: nestedTask }) => {
              return translate({
                file,
                locale,
                defaultLocale,
                task: nestedTask,
              });
            }
          )
        ),
      {
        concurrency: 5,
      }
    );

    if (isCalledFromGitHook) {
      Promise.allSettled(translationTasks).then(() => {
        execa("git", ["add", "."]);
      });
    }
  }
);
