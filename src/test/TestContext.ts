import { IPerformanceConfiguration } from "../util/IPerformanceConfiguration";
import { IWritable } from "../reporter/IWriteable";
import { TestReporter } from "./TestReporter";
import { EmptyReporter } from "../reporter/EmptyReporter";
import { ASUtil } from "assemblyscript/lib/loader";
import { IAspectExports } from "../util/IAspectExports";
import { ActualValue } from "../util/ActualValue";
import { ILogTarget } from "../util/ILogTarget";
import { LogValue } from "../util/LogValue";

const wasmFilter = (input: string): boolean => /wasm-function/i.test(input);

export interface ITestContextParameters {
  reporter?: TestReporter;
  stdout?: IWritable;
  stderr?: IWritable;
  performanceConfiguration?: IPerformanceConfiguration;
  testRegex?: RegExp;
  groupRegex?: RegExp;
  fileName?: string;
}

export class TestContext {
  private reporter: TestReporter = new EmptyReporter();
  /* istanbul ignore next */
  public stdout: IWritable | null = process ? process.stdout : null;
  /* istanbul ignore next */
  public stderr: IWritable | null = process.stderr ? process.stderr : null;
  private performanceConfiguration: IPerformanceConfiguration = {};
  public testRegex: RegExp = new RegExp("");
  public groupRegex: RegExp = new RegExp("");
  public fileName: string = "";

  public wasm: (ASUtil & IAspectExports) | null = null;

  private actual: ActualValue | null = null;
  private expected: ActualValue | null = null;
  private logTarget: ILogTarget = {
    logs: [],
    stack: "",
    message: "",
  };

  constructor(props?: ITestContextParameters) {
    if (props) {
      if (props.reporter) this.reporter = props.reporter;
      if (props.stdout) this.stdout = props.stdout;
      if (props.stderr) this.stderr = props.stderr;
      if (props.performanceConfiguration) this.performanceConfiguration = props.performanceConfiguration;
      if (props.testRegex) this.testRegex = props.testRegex;
      if (props.groupRegex) this.groupRegex = props.groupRegex;
      if (props.fileName) this.fileName = props.fileName;
    }
  }

  /**
   * This method creates a WebAssembly imports object with all the TestContext functions
   * bound to the TestContext.
   *
   * @param {any[]} imports - Every import item specified.
   */
  public createImports(...imports: any[]): any {
    const result = Object.assign({}, ...imports, {
      __aspect: {
        clearExpected: this.clearExpected.bind(this),
        debug: this.debug.bind(this),
        tryCall: this.tryCall.bind(this),
        logNull: this.logNull.bind(this),
        logReference: this.logReference.bind(this),
        logString: this.logString.bind(this),
        logValue: this.logValue.bind(this),
        reportActualNull: this.reportActualNull.bind(this),
        reportExpectedNull: this.reportExpectedNull.bind(this),
        reportActualValue: this.reportActualValue.bind(this),
        reportExpectedValue: this.reportExpectedValue.bind(this),
        reportActualReference: this.reportActualReference.bind(this),
        reportExpectedReference: this.reportExpectedReference.bind(this),
        reportActualString: this.reportActualString.bind(this),
        reportExpectedString: this.reportExpectedString.bind(this),
        reportExpectedTruthy: this.reportExpectedTruthy.bind(this),
        reportExpectedFalsy: this.reportExpectedFalsy.bind(this),
        reportExpectedFinite: this.reportExpectedFinite.bind(this),
      },
    });
    result.env = result.env || {};
    const previousAbort = (result.env.abort) || (() => {});
    result.env.abort = (...args: any[]) => {
      previousAbort(...args);
      // @ts-ignore
      this.abort(...args);
    };
    return result;
  }

  /**
   * This function reports an actual null value.
   */
  private reportActualNull(): void {
    const value = new ActualValue();
    value.message = `null`;
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.value = null;
    this.actual = value;
  }

  /**
   * This function reports an expected null value.
   *
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedNull(negated: 1 | 0): void {
    const value = new ActualValue();
    value.message = `null`;
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    value.value = null;
    this.expected = value;
  }

  /**
   * This function reports an actual numeric value.
   *
   * @param {number} numericValue - The value to be expected.
   */
  private reportActualValue(numericValue: number): void {
    const value = new ActualValue();
    value.message = numericValue.toString();
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.value = numericValue;
    this.actual = value;
  }

  /**
   * This function reports an expected numeric value.
   *
   * @param {number} numericValue - The value to be expected
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedValue(numericValue: number, negated: 0 | 1): void {
    const value = new ActualValue();
    value.message = numericValue.toString();
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    value.value = numericValue;
    this.expected = value;
  }

 /**
  * This function reports an actual reference value.
  *
  * @param {number} referencePointer - The actual reference pointer.
  * @param {number} offset - The size of the reference in bytes.
  */
 private reportActualReference(referencePointer: number, offset: number): void {
   const value = new ActualValue();
   value.message = "Reference Value";
   value.stack = this.getLogStackTrace();
   value.target = this.logTarget;
   value.pointer = referencePointer;
   value.offset = offset;
   value.bytes = Array.from(this.wasm!.U8.slice(referencePointer, referencePointer + offset));
   value.value = referencePointer;
   this.actual = value;
 }

 /**
  * This function reports an expected reference value.
  *
  * @param {number} referencePointer - The expected reference pointer.
  * @param {number} offset - The size of the reference in bytes.
  * @param {1 | 0} negated - An indicator if the expectation is negated.
  */
 private reportExpectedReference(referencePointer: number, offset: number, negated: 1 | 0): void {
   const value = new ActualValue();
   value.message = "Reference Value";
   value.stack = this.getLogStackTrace();
   value.target = this.logTarget;
   value.pointer = referencePointer;
   value.offset = offset;
   value.bytes = Array.from(this.wasm!.U8.slice(referencePointer, referencePointer + offset));
   value.negated = negated === 1;
   value.value = referencePointer;
   this.expected = value;
 }

  /**
   * This function reports an expected truthy value.
   *
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedTruthy(negated: 1 | 0): void {
    const value = new ActualValue();
    value.message = "Truthy Value";
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    this.expected = value;
  }

  /**
   * This function reports an expected falsy value.
   *
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedFalsy(negated: 1 | 0): void {
    const value = new ActualValue();
    value.message = "Falsy Value";
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    this.expected = value;
  }

  /**
   * This function reports an expected finite value.
   *
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedFinite(negated: 1 | 0): void {
    const value = new ActualValue();
    value.message = "Finite Value";
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    this.expected = value;
  }

  /**
   * This function reports an actual string value.
   *
   * @param {number} stringPointer - A pointer that points to the actual string.
   */
  private reportActualString(stringPointer: number): void {
    const value = new ActualValue();
    value.message = this.wasm!.__getString(stringPointer);
    value.pointer = stringPointer;
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.value = stringPointer;
    this.actual = value;
  }

  /**
   * This function reports an expected string value.
   *
   * @param {number} stringPointer - A pointer that points to the expected string.
   * @param {1 | 0} negated - An indicator if the expectation is negated.
   */
  private reportExpectedString(stringPointer: number, negated: 1 | 0): void {
    const value = new ActualValue();
    value.message = this.wasm!.__getString(stringPointer);
    value.pointer = stringPointer;
    value.stack = this.getLogStackTrace();
    value.target = this.logTarget;
    value.negated = negated === 1;
    value.value = stringPointer;
    this.expected = value;
  }

  /**
   * This function overrides the provided AssemblyScript `env.abort()` function to catch abort
   * reasons.
   *
   * @param {number} reasonPointer - This points to the message value that causes the expectation to
   * fail.
   * @param {number} _fileNamePointer - The file name that reported the error. (Ignored)
   * @param {number} _line - The line that reported the error. (Ignored)
   * @param {number} _col - The column that reported the error. (Ignored)
   */
  private abort(reasonPointer: number, _fileNamePointer: number, _line: number, _col: number): void {
    this.logTarget.message = this.wasm!.__getString(reasonPointer);
  }

  /**
   * Gets a log stack trace.
   */
  private getLogStackTrace(): string {
    return new Error("Get stack trace.")
      .stack!
      .toString()
      .split("\n")
      .slice(1)
      .filter(wasmFilter)
      .join("\n");
  }

  /**
   * Gets an error stack trace.
   */
  private getErrorStackTrace(ex: Error): string {
    var stackItems = ex.stack!.toString().split("\n");
    return [stackItems[0], ...stackItems.slice(1).filter(wasmFilter)].join("\n");
  }

  /**
   * This is called to stop the debugger.  e.g. `node --inspect-brk asp`.
   */
  private debug(): void { debugger; }

  /**
   * This is a web assembly utility function that wraps a function call in a try catch block to
   * report success or failure.
   *
   * @param {number} pointer - The function pointer to call. It must accept no parameters and return
   * void.
   * @returns {1 | 0} - If the callback was run successfully without error, it returns 1, else it
   * returns 0.
   */
  protected tryCall(pointer: number): 1 | 0 {
    if (pointer === -1) return 1;

    try {
      this.wasm!.__call(pointer)
    } catch (ex){
      this.logTarget.stack = this.getErrorStackTrace(ex);
      return 0;
    }
    return 1;
  }

  /**
   * Log a null value to the reporter.
   */
  private logNull(): void {
    // create a new log value
    const value = new LogValue();
    const target = this.logTarget;

    // collect log metadata
    value.stack = this.getLogStackTrace();
    value.message = "null";
    value.target = target;

    // push the log value to the logs
    target.logs.push(value);
  }

  /**
   * This function is called after each expectation if the expectation passes. This prevents other
   * unreachable() conditions that throw errors to report actual and expected values too.
   */
  private clearExpected(): void {
    this.expected = null;
    this.actual = null;
    this.logTarget.stack = "";
  }

  /**
   * Log a reference to the reporter.
   *
   * @param {number} referencePointer - The pointer to the reference.
   * @param {number} offset - The offset of the reference.
   */
  private logReference(referencePointer: number, offset: number): void {
    const value = new LogValue();
    const target = this.logTarget;

    value.bytes = Array.from(this.wasm!.U8.slice(referencePointer, referencePointer + offset));
    value.message = "Reference Type";
    value.offset = offset;
    value.pointer = referencePointer;
    value.stack = this.getLogStackTrace();
    value.target = target;
    value.value = referencePointer;

    // push the log value to the logs
    target.logs.push(value);
  }

  /**
   * This adds a logged string to the current test.
   *
   * @param {number} pointer - The pointer to the logged string reference.
   */
  private logString(pointer: number): void {
    const value = new LogValue();
    const target = this.logTarget;

    value.message = this.wasm!.__getString(pointer);
    value.offset = 0;
    value.pointer = pointer;
    value.stack = this.getLogStackTrace();
    value.target = target;
    value.value = pointer;

    // push the log value to the logs
    target.logs.push(value);
  }

  /**
   * Log a numevalueric value to the reporter.
   *
   * @param {number} value - The value to be logged.
   */
  private logValue(numericValue: number): void {
    const value = new LogValue();
    const target = this.logTarget;

    value.stack = this.getLogStackTrace();
    value.message = `Value ${numericValue.toString()}`;
    value.value = numericValue;
    value.target = target;

    // push the log value to the logs
    target.logs.push(value);
  }
}