export let groups: TestContext[] = new Array<TestContext>(0);

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "createGroup")
declare function createGroup(group: string): bool;

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "createTestResult")
declare function createTest(name: string): bool;

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "now")
declare function now(): f64;

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "finish")
declare function finish(): f64;

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "tryCall")
declare function tryCall(callback: () => void): bool;

// @ts-ignore: Decorators *are* valid here
@external("__aspect", "testEnd")
declare function testEnd(result: bool, pass: bool, negated: bool, start: f64, end: f64): void;


// @ts-ignore: Decorators *are* valid here
@external("__aspect", "groupEnd")
declare function groupEnd(): void;

export function __run(): void {
  let start = now();
  // for each test group
  for (let i = 0; i < groups.length; i++) {
    runGroup(groups[i]);
  }
  let end = now();
  finish();
}

// @ts-ignore: decorators *are* valid here
@inline
function runGroup(group: TestContext): void {
  // start the timer
  group.start = now();

  let canRun: bool = false;

  // create a group, but only if it matches the input regex
  canRun = createGroup(group.name);

  // if it doesn't match, go to the next group
  if (!canRun) return;

  // run beforeAll callbacks
  if (!runBeforeAll(group)) return;

  let testName: string = "";

  // for each test
  for (let i = 0; i < group.tests.length; i++) {
    // create a test
    testName = group.testNames[i];
    canRun = createTest(testName)

    // if it doesn't match the test regex, continue
    if (!canRun) continue;

    // runBeforeEach (verify no errors)
    if (!runBeforeEach(group)) return;

    // run the test
    runTest(group, i);

    // run afterEach (verify no errors)
    if (!runAfterEach(group)) return;
  }


  // run afterAll
  if (!runAfterAll(group)) return;

  // no matter what happens, the group is finished
  finishGroup(group);
}

function runBeforeAll(context: TestContext): bool {
  if (context.parent) {
    let result = runBeforeAll(context.parent);
    if (!result) return false;
  }
  for (let i = 0; i < context.beforeAll.length; i++) {
    if (!tryCall(context.beforeEach[i])) {
      finishGroup(context);
      return false;
    }
  }
  return true;
}

function runBeforeEach(context: TestContext): bool {
  if (context.parent) {
    let result = runBeforeEach(context.parent);
    if (!result) return false;
  }
  for (let i = 0; i < context.beforeEach.length; i++) {
    if (!tryCall(context.beforeEach[i])) {
      finishGroup(context);
      return false;
    }
  }
  return true;
}

function runAfterAll(context: TestContext): bool {
  if (context.parent) {
    let result = runAfterAll(context.parent);
    if (!result) return false;
  }
  for (let i = 0; i < context.afterAll.length; i++) {
    if (!tryCall(context.afterAll[i])) {
      finishGroup(context);
      return false;
    }
  }
  return true;
}

function runAfterEach(context: TestContext): bool {
  if (context.parent) {
    let result = runAfterEach(context.parent);
    if (!result) return false;
  }
  for (let i = 0; i < context.afterEach.length; i++) {
    if (!tryCall(context.afterEach[i])) {
      finishGroup(context);
      return false;
    }
  }
  return true;
}

// @ts-ignore: Decorators *are* valid here
@inline
function finishGroup(_context: TestContext): void {
  groupEnd();
}

function runTest(context: TestContext, testIndex: i32): void {
  let start = now();
  let callback = context.tests[testIndex];
  let negated = context.negated[testIndex];
  let result = tryCall(callback);
  let pass = bool(i32(result) ^ i32(negated));
  let end = now();
  testEnd(result, pass, negated, start, end);
}
