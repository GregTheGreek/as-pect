import fs from "fs";

/**
 * This method promisifies the fs.writeFile function call, and is compatible with node 10.
 *
 * @param {string} file - The file location to write to.
 * @param {Uint8Array} contents - The file contents to write to the disk.
 */
export function writeFile(file: string, contents: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(file, contents, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
