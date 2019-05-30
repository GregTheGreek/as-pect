type Callback = () => void;

class TestContext {
  public name: string = "";
  public beforeEach: Callback[] = new Array<Callback>(0);
  public beforeAll: Callback[] =  new Array<Callback>(0);
  public afterEach: Callback[] = new Array<Callback>(0);
  public afterAll: Callback[] =  new Array<Callback>(0);

  public tests: Callback[] = new Array<Callback>(0);
  public testNames: string[] = new Array<string>(0);
  public negated: bool[] = new Array<bool>(0);

  public todos: string[] = new Array<string>(0);

  public parent: TestContext | null = null;

  @inline
  public fork(name: string): TestContext {
    let t = new TestContext();
    t.name = this.name + " " + name;
    t.afterAll = this.afterAll.slice(0);
    t.afterEach = this.afterEach.slice(0);
    t.beforeAll = this.beforeAll.slice(0);
    t.beforeEach = this.beforeEach.slice(0);
    t.parent = this;
    return t;
  }

  public start: f64 = 0;
  public end: f64 = 0;
}