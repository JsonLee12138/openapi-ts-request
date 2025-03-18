#!/usr/bin/env node
import { type OptionValues, program } from 'commander';
import { pickBy } from 'lodash';
import { join } from 'path';

import * as pkg from '../../package.json';
import { GenerateServiceProps, generateService } from '../index';
import { logError } from '../log';
import { readConfig } from '../readConfig';
import { IPriorityRule, IReactQueryMode } from '../type';

const params = program
  .name('openapi')
  .usage('[options]')
  .version(pkg.version)
  // .requiredOption(
  //   '-i, --input <string>',
  //   'OpenAPI specification, can be a path, url (required)'
  // )
  // .requiredOption('-o, --output <string>', 'output directory (required)')
  .option('-i, --input <string>', 'OpenAPI specification, can be a path, url')
  .option('-o, --output <string>', 'output directory')
  .option('-cfn, --configFileName <configFileName>', 'config file name')
  .option('-cfp, --configFilePath <configFilePath>', 'config file path')
  .option(
    '--requestLibPath <string>',
    'custom request lib path, for example: "@/request", "node-fetch" (default: "axios")'
  )
  .option('--enableLogging <boolean>', 'open the log', false)
  .option(
    '--priorityRule <string>',
    'priority rule, include/exclude/both (default: "include")'
  )
  .option(
    '--includeTags <(string|RegExp)[]>',
    'generate code from include tags'
  )
  .option(
    '--includePaths <(string|RegExp)[]>',
    'generate code from include paths'
  )
  .option(
    '--excludeTags <(string|RegExp)[]>',
    'generate code from exclude tags'
  )
  .option(
    '--excludePaths <(string|RegExp)[]>',
    'generate code from exclude paths'
  )
  .option(
    '--requestOptionsType <string>',
    'custom request method options parameter type (default: "{ [key: string]: unknown }")'
  )
  .option(
    '--requestImportStatement <string>',
    `custom request import statement, for example: "const request = require('@/request')"`
  )
  .option(
    '--apiPrefix <string>',
    `custom the prefix of the api path, for example: "api"(variable), "'api'"(string)`
  )
  .option('--isGenReactQuery <boolean>', 'generate react-query', false)
  .option(
    '--reactQueryMode <string>',
    'react-query mode, react/vue (default: "react")'
  )
  .option('--isGenJavaScript <boolean>', 'generate JavaScript', false)
  .option(
    '--isDisplayTypeLabel <boolean>',
    'generate label matching type field',
    false
  )
  .option('--isGenJsonSchemas <boolean>', 'generate JSON Schemas', false)
  .option('--mockFolder <string>', 'mock file path')
  .option('--authorization <string>', 'docs authorization')
  .option('--nullable <boolean>', 'null instead of optional', false)
  .option(
    '--isTranslateToEnglishTag <boolean>',
    'translate chinese tag name to english tag name',
    false
  )
  .option(
    '--isOnlyGenTypeScriptType <boolean>',
    'only generate typescript type',
    false
  )
  .option(
    '--isCamelCase <boolean>',
    'camelCase naming of controller files and request client',
    true
  )
  .option(
    '--isSupportParseEnumDesc <boolean>',
    'parse enum description to generate enum label',
    false
  )
  .option('-u, --unique-key <uniqueKey>', 'unique key')
  .option('-f, --full <boolean>', 'full replacement', false)
  .parse(process.argv)
  .opts();

function getPath(path: string) {
  const isUrl = path.startsWith('http');

  if (isUrl) {
    return path;
  }

  return join(process.cwd(), path);
}

const baseGenerate = (_params_: OptionValues): GenerateServiceProps => {
  const input = getPath(_params_.input as string);
  const output = getPath(_params_.output as string);
  const options: GenerateServiceProps = {
    schemaPath: input,
    serversPath: output,
    requestLibPath: _params_.requestLibPath as string,
    enableLogging: JSON.parse(_params_.enableLogging as string) === true,
    priorityRule: _params_.priorityRule as IPriorityRule,
    includeTags: _params_.includeTags as string[],
    includePaths: _params_.includePaths as string[],
    excludeTags: _params_.excludeTags as string[],
    excludePaths: _params_.excludePaths as string[],
    requestOptionsType: _params_.requestOptionsType as string,
    apiPrefix: _params_.apiPrefix as string,
    isGenReactQuery: JSON.parse(_params_.isGenReactQuery as string) === true,
    reactQueryMode: _params_.reactQueryMode as IReactQueryMode,
    isGenJavaScript: JSON.parse(_params_.isGenJavaScript as string) === true,
    isDisplayTypeLabel:
      JSON.parse(_params_.isDisplayTypeLabel as string) === true,
    isGenJsonSchemas: JSON.parse(_params_.isGenJsonSchemas as string) === true,
    mockFolder: _params_.mockFolder as string,
    authorization: _params_.authorization as string,
    nullable: JSON.parse(_params_.nullable as string) === true,
    isTranslateToEnglishTag:
      JSON.parse(_params_.isTranslateToEnglishTag as string) === true,
    isOnlyGenTypeScriptType:
      JSON.parse(_params_.isOnlyGenTypeScriptType as string) === true,
    isCamelCase: JSON.parse(_params_.isCamelCase as string) === true,
    isSupportParseEnumDesc:
      JSON.parse(_params_.isSupportParseEnumDesc as string) === true,
  };
  return options;
};

async function run() {
  if (params.input && params.output) {
    const options = baseGenerate(params);
    await generateService(
      pickBy(
        options,
        (value) => value !== null && value !== undefined && value !== ''
      ) as GenerateServiceProps
    );
    process.exit(0);
  }
  const cnf = await readConfig<GenerateServiceProps | GenerateServiceProps[]>({
    fallbackName: 'openapi-ts-request',
    filePath: params.configFilePath as string,
    fileName: params.configFileName as undefined,
  });
  try {
    if (cnf) {
      const tasks = [];
      let configs: GenerateServiceProps[] = Array.isArray(cnf) ? cnf : [cnf];
      if (params.uniqueKey) {
        configs = configs.filter(
          (config) => config.uniqueKey === params.uniqueKey
        );
      }
      for (const config of configs) {
        tasks.push(generateService(config));
      }
      const results = await Promise.allSettled(tasks);
      const errors: PromiseRejectedResult[] = results.filter(
        (result) => result.status === 'rejected'
      );
      let errorMsg = '';
      for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        const cnf = configs[i];
        errorMsg += `${cnf.uniqueKey}${cnf.uniqueKey && ':'}${error.reason}\n`;
      }
      if (errorMsg) {
        logError(errorMsg);
        process.exit(1);
      }
    } else {
      if (!params.input || !params.output) {
        logError(
          'Please provide either input/output options or a configuration file path and name.'
        );
        process.exit(1);
      }
      const options = baseGenerate(params);
      await generateService(
        pickBy(
          options,
          (value) => value !== null && value !== undefined && value !== ''
        ) as GenerateServiceProps
      );
      process.exit(0);
    }
  } catch (error) {
    logError(error);
    process.exit(1);
  }
}

void run();
