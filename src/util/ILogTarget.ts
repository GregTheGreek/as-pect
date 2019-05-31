import { LogValue } from "./LogValue";

export interface ILogTarget {
  message: string;
  logs: LogValue[];
  stack: string;
}
