interface MyErrorOptions extends ErrorOptions {
  code?: number;
}

class MyError extends Error {
  public code?: number;

  constructor(message: string, options?: MyErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    if (options?.code) this.code = options.code;
  }
}

export { MyError, MyErrorOptions };
export default MyError;