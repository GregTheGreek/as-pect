import { noOp } from "../util/noOp";
import { groups } from "./run";

// @ts-ignore: Decorators *are* valid here!
@external("__aspect", "debug")
@global
export declare function debug(): void;

let root: TestContext = new TestContext();

let contextStack: TestContext[] = new Array<TestContext>(0);
contextStack.push(root);
let contextStackIndex: i32 = 0;

// @ts-ignore: Decorators *are* valid here
@inline
function currentContext(): TestContext {
  return contextStack[contextStackIndex];
}


groups.push(root);

// @ts-ignore: Decorators *are* valid here!
@global
export function describe(name: string = "", tests: () => void = noOp): void {
  let current = contextStack[contextStackIndex];
  let next = current.fork(name);
  contextStackIndex += 1;

  if (contextStack.length >= contextStackIndex) {
    contextStack.push(next);
  } else {
    contextStack[contextStackIndex] = next;
  }

  tests();

  contextStackIndex -= 1;
  groups.push(next);
}

// @ts-ignore: Decorators *are* valid here!
@global
export function todo(description: string): void {
  let ctx = currentContext();
  ctx.todos.push(description);
}

// @ts-ignore: decorators *are* valid here
@global
export function xit(description: string, callback: () => void): void {
  todo(description);
}

// @ts-ignore: decorators *are* valid here
@global
export function xtest(description: string, callback: () => void): void {
  todo(description);
}

// @ts-ignore: decorators *are* valid here
@global
export function it(description: string, runner: () => void): void {
  let ctx = currentContext();
  ctx.testNames.push(description);
  ctx.tests.push(runner);
  ctx.negated.push(false);
}

// @ts-ignore: decorators *are* valid here
@global
export function test(description: string, runner: () => void): void {
  it(description, runner);
}

// @ts-ignore: decorators *are* valid here
@global
export function beforeEach(callback: () => void): void {
  let ctx = currentContext();
  ctx.beforeEach.push(callback);
}

// @ts-ignore: decorators *are* valid here
@global
export function beforeAll(callback: () => void): void {
  let ctx = currentContext();
  ctx.beforeAll.push(callback);
}

// @ts-ignore: decorators *are* valid here
@global
export function afterEach(callback: () => void): void {
  let ctx = currentContext();
  ctx.afterEach.push(callback);
}

// @ts-ignore: decorators *are* valid here
@global
export function afterAll(callback: () => void): void {
  let ctx = currentContext();
  ctx.afterAll.push(callback);
}

// @ts-ignore: decorators *are* valid here
@global
export function throws(description: string, callback: () => void, message: string = ""): void {
  let ctx = currentContext();
  ctx.testNames.push(description);
  ctx.tests.push(callback);
  ctx.negated.push(true);
}
