
import { TestContext } from "../test/TestContext";
import * as fs from "fs";
import { TestReporter } from "../test/TestReporter";
import { DefaultTestReporter } from "../reporter/DefaultTestReporter";
import { performance } from "perf_hooks";
import { timeDifference } from "../util/timeDifference";
import { IWarning } from "../test/IWarning";
import * as path from "path";
import chalk from "chalk";
import { IConfiguration, ICompilerFlags } from "../util/IConfiguration";
import glob from "glob";
import { collectReporter } from "./util/collectReporter";
import { getTestEntryFiles } from "./util/getTestEntryFiles";
import { Options } from "./util/CommandLineArg";
import { IAspectExports } from "../util/IAspectExports";
import { writeFile } from "./util/writeFile";

/**
 * This method actually runs the test suites in sequential order synchronously.
 *
 * @param {IYargs} yargs - The command line arguments.
 * @param {string[]} compilerArgs - The `asc` compiler arguments.
 */
export function run(yargs: Options, compilerArgs: string[]): void {
  const start = performance.now();

  /**
   * Instead of using `import`, the strategy is to encourage node to start the testing process
   * as soon as possible. Calling require and measuring the performance of compiler loading shows
   * developers a meaningful explaination of why it takes a few seconds for the software to start
   * running.
   */
  console.log(chalk`{bgWhite.black [Log]} Loading asc compiler`);
  let asc: any;
  let instantiateBuffer: any;
  let parse: any
  try {
    /** Collect the assemblyscript module path. */
    const assemblyScriptFolder = yargs.compiler.startsWith(".")
      ? path.join(process.cwd(), yargs.compiler)
      : yargs.compiler;

    /** Next, obtain the compiler, and assert it has a main function. */
    asc = require(path.join(assemblyScriptFolder, "dist", "asc"));
    if (!asc){
      throw new Error(`${yargs.compiler}/dist/asc has no exports.`);
    }
    if (!asc.main) {
      throw new Error(`${yargs.compiler}/dist/asc does not export a main() function.`);
    }

    /** Next, collect the loader, and assert it has an instantiateBuffer method. */
    let loader = require(path.join(assemblyScriptFolder, "lib", "loader"));
    if (!loader) {
      throw new Error(`${yargs.compiler}/lib/loader has no exports.`);
    }
    if (!loader.instantiateBuffer) {
      throw new Error(`${yargs.compiler}/lib/loader does not export an instantiateBuffer() method.`);
    }
    instantiateBuffer = loader.instantiateBuffer;

    /** Finally, collect the cli options from assemblyscript. */
    let options = require(path.join(assemblyScriptFolder, "cli", "util", "options"));
    if (!options) {
      throw new Error(`${yargs.compiler}/cli/util/options exports null`)
    }

    if (!options.parse) {
      throw new Error(`${yargs.compiler}/cli/util/options does not export a parse() method.`);
    }
    parse = options.parse;
  } catch (ex){
    console.error(chalk`{bgRedBright.black [Error]} There was a problem loading {bold [${yargs.compiler}]}.`);
    console.error(ex);
    process.exit(1);
  }

  console.log(chalk`{bgWhite.black [Log]} Compiler loaded in ${timeDifference(performance.now(), start).toString()}ms.`);

  // obtain the configuration file
  const configurationPath = path.resolve(
    process.cwd(),
    yargs.config,
  );
  console.log(chalk`{bgWhite.black [Log]} Using configuration ${configurationPath}`);

  let configuration: IConfiguration = {};

  try {
    configuration = require(configurationPath) || {};
  } catch (ex) {
    console.error("");
    console.error(chalk`{bgRedBright.black [Error]} There was a problem loading {bold [${configurationPath}]}.`);
    console.error(ex);
    process.exit(1);
  }

  // configuration must be an object
  if (!configuration) {
    console.error(chalk`{bgRedBright.black [Error]} Configuration at {bold [${configurationPath}]} is null or not an object.`);
    process.exit(1);
  }

  const include: string[] = configuration.include || ["assembly/__tests__/**/*.spec.ts"];
  const add: string[] = configuration.add || ["assembly/__tests__/**/*.include.ts"];

  // parse passed cli compiler arguments and let them override defaults.
  const { options: ascOptions, unknown } = compilerArgs.length > 0
    ? parse(compilerArgs, asc.options as any)
    : { options: {}, unknown: [] };
  if (unknown.length > 0) {
    console.error(chalk`{bgRedBright.black [Error]} Unknown compiler arguments {bold [${unknown.join(", ")}]}.`);
    process.exit(1);
  }
  const flags: ICompilerFlags = Object.assign(ascOptions, configuration.flags, {
    "--validate": [],
    "--debug": [],
    /** This is required. Do not change this. */
    "--binaryFile": ["output.wasm"],
  });

  /** It's useful to notify the user that optimizations will make test compile times slower. */
  if (flags.hasOwnProperty("-O3") || flags.hasOwnProperty("-O2") || flags.hasOwnProperty("--optimize")) {
    console.log(chalk`{yellow [Warning]} Using optimizations. This may result in slow test compilation times.`);
  }

  const disclude: RegExp[] = configuration.disclude || [];

  // if a reporter is specified in cli arguments, override configuration
  const reporter: TestReporter = yargs.reporter
    ? collectReporter(yargs)
    : configuration.reporter || new DefaultTestReporter();

  if (configuration.performance){
    Object.getOwnPropertyNames(configuration.performance).forEach(option => {
      if (yargs.changed.has("performance."+option)){
        yargs.performance[option] = configuration.performance![option]!;
      }
    })
  }
  const performanceConfiguration = yargs.performance;

  // include all the file globs
  console.log(chalk`{bgWhite.black [Log]} Including files: ${include.join(", ")}`);

  // Create the test and group matchers
  
  const testRegex = new RegExp(yargs.test, "i");
  configuration.testRegex = testRegex;
  console.log(chalk`{bgWhite.black [Log]} Running tests that match: ${testRegex.source}`);



  const groupRegex = new RegExp(yargs.group, "i");
  configuration.groupRegex = groupRegex;
  console.log(chalk`{bgWhite.black [Log]} Running groups that match: ${groupRegex.source}`);


  /**
   * Check to see if the binary files should be written to the fileSystem.
   */
  const outputBinary: boolean = !!(yargs.outputBinary || configuration.outputBinary);
  if (outputBinary) {
    console.log(chalk`{bgWhite.black [Log]} Outputing Binary *.wasm files.`);
  }

  /**
   * Check to see if rtrace is disabled.
   */
  configuration.nortrace = yargs.nortrace;


  /**
   * If rtrace is enabled, add `--use ASC_RTRACE=1` to the command line parameters.
   */
  if (!configuration.nortrace) {
    console.log(chalk`{bgWhite.black [Log]} Reference Tracing is enabled.`)
    if (flags["--use"]) {
      flags["--use"].push("--use", "ASC_RTRACE=1");
    } else {
      flags["--use"] = ["ASC_RTRACE=1"];
    }
  }

  /**
   * Check to see if the tests should be run in the first place.
   */
  const runTests: boolean = !yargs.norun;
  if (!runTests) {
    console.log(chalk`{bgWhite.black [Log]} Not running tests, only outputting files.`);
  }

  if (compilerArgs.length > 0) {
    console.log(chalk`{bgWhite.black [Log]} Adding compiler arguments: ` + compilerArgs.join(" "));
  }

  const addedTestEntryFiles: Set<string> = new Set<string>();

  /** Get all the test entry files. */
  const testEntryFiles = getTestEntryFiles(yargs, include, disclude);

  for (const pattern of add) {
    // push all the added files to the added entry point list
    for (const entry of glob.sync(pattern)) {
      addedTestEntryFiles.add(entry);
    }
  }

  // loop over each file and create a binary, index it on binaries
  const binaries: { [i: number]: Uint8Array } = {};

  // must include the assembly/index.ts file located in the package
  const entryPath = path.join(__dirname, "../../assembly/index.ts");
  const relativeEntryPath = path.relative(process.cwd(), entryPath);

  // add the relativeEntryPath of as-pect to the list of compiled files for each test
  addedTestEntryFiles.add(relativeEntryPath);

  // Create a test runner, and run each test
  let count = testEntryFiles.size;

  flags["--explicitStart"] = [];

  // create the array of compiler flags from the flags object
  const flagList: string[] = Object.entries(flags)
    .reduce((args: string[], [flag, options]) => args.concat(flag, options), []);

  let testCount = 0;
  let successCount = 0;
  let groupSuccessCount = 0;
  let groupCount = 0;
  let errors: IWarning[] = [];
  let filePromises: Promise<void>[] = [];
  let failed = false;

  const folderMap = new Map<string, string[]>();
  const fileMap = new Map<string, string>();
  console.log(chalk`{bgWhite.black [Log]} Effective command line args:`);
  console.log(chalk`  {green [TestFile.ts]} {yellow ${Array.from(addedTestEntryFiles).join(" ")}} ${flagList.join(" ")}`);

  // add a line seperator between the next line and this line
  console.log("");

  // for each file, synchronously run each test
  Array.from(testEntryFiles).forEach((file: string, i: number) => {
    asc.main([file, ...Array.from(addedTestEntryFiles), ...flagList], {
      stdout: process.stdout as any, // use any type to quelch error
      stderr: process.stderr as any,
      listFiles(dirname: string, baseDir: string): string[] {
        const folder = path.join(baseDir, dirname);
        if (folderMap.has(folder)) {
          return folderMap.get(folder)!;
        }

        try {
          const results = fs.readdirSync(folder).filter(file => /^(?!.*\.d\.ts$).*\.ts$/.test(file));
          folderMap.set(folder, results);
          return results;
        } catch (e) {
          return [];
        }
      },
      readFile(filename: string, baseDir: string) {
        const fileName = path.join(baseDir, filename);
        if (fileMap.has(fileName)){
          return fileMap.get(fileName)!;
        }

        try {
          const contents = fs.readFileSync(fileName, { encoding: "utf8" });
          fileMap.set(fileName, contents);
          return contents;
        } catch (e) {
          return null;
        }
      },
      writeFile(name: string, contents: Uint8Array) {
        const ext = path.extname(name)
        // get the wasm file
        if (ext === ".wasm") {
          binaries[i] = contents;
          if (!outputBinary) return;
        }

        const outfileName = path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext);
        filePromises.push(writeFile(outfileName, contents));
      }
    }, function (error: Error | null): number {
      // if there are any compilation errors, stop the test suite
      if (error) {
        console.error(chalk`{red [Error]} There was a compilation error when trying to create the wasm binary for file: ${file}.`);
        console.error(error);
        return process.exit(1);
      }

      // if the binary wasn't emitted, stop the test suite
      if (!binaries[i]) {
        console.error(chalk`{red [Error]} There was no output binary file: ${file}. Did you forget to emit the binary with {yellow --binaryFile}?`);
        return process.exit(1);
      }

      if (runTests) {
        // create a test runner
        const runner = new TestContext({
          fileName: file,
          groupRegex: configuration.groupRegex,
          testRegex: configuration.testRegex,
          performanceConfiguration,
          reporter,
        });

        // detect custom imports
        const customImportFileLocation = path.resolve(
          path.join(
            path.dirname(file),
            path.basename(file, path.extname(file)) + ".imports.js",
          ),
        );
        const imports = runner.createImports(
          (fs.existsSync(customImportFileLocation)
            ? require(customImportFileLocation)
            : configuration!.imports
          ) || {},
        );

        // instantiate the module
        const wasm: IAspectExports = instantiateBuffer(binaries[i], imports);

        if (runner.errors.length > 0) {
          errors.push(...runner.errors);
        } else {
          // call run buffer because it's already compiled
          runner.run(wasm);
          testCount += runner.testGroups
            .reduce((left, right) => left + right.tests.length, 0);
          successCount += runner.testGroups
            .reduce((left, right) => left + right.tests.filter(e => e.pass).length, 0);
          groupCount += runner.testGroups.length;
          groupSuccessCount = runner.testGroups
            .reduce((left, right) => left + (right.pass ? 1 : 0), groupSuccessCount);
          errors.push(...runner.errors); // if there are any runtime allocation errors add them
        }
      }

      count -= 1;

      // if any tests failed, and they all ran, exit(1)
      if (count === 0) {
        if (runTests) {
          const end = performance.now();
          failed = testCount !== successCount || errors.length > 0;
          const result = failed
            ? chalk`{red ✖ FAIL}`
            : chalk`{green ✔ PASS}`;
          console.log("~".repeat(process.stdout.columns! - 10));

          for (const error of errors) {
            console.log(chalk`
   [Error]: {red ${error.type}}: ${error.message}
   [Stack]: {yellow ${error.stackTrace.split("\n").join("\n            ")}}
  `)
          }
          console.log(`
  [Result]: ${result}
   [Files]: ${testEntryFiles.size} total
  [Groups]: ${groupCount} count, ${groupSuccessCount} pass
   [Tests]: ${successCount.toString()} pass, ${(testCount - successCount).toString()} fail, ${testCount.toString()} total
    [Time]: ${timeDifference(end, start).toString()}ms`);
        }
        Promise.all(filePromises).then(() => {
          if (failed) process.exit(1);
        });
      }
      return 0;
    });
  });
}
