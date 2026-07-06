import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { execSync } from "child_process";
import { getProjectRoot } from "./registry.js";

const fileLocks = new Map();
const LOCK_TIMEOUT = 30000; // 30 seconds

function acquireLock(path, agent = "unknown") {
  const lock = fileLocks.get(path);

  if (lock) {
    // Check if lock expired
    if (Date.now() - lock.timestamp > LOCK_TIMEOUT) {
      console.log(`[Lock] Expired lock on ${path} by ${lock.agent}, releasing`);
      fileLocks.delete(path);
    } else {
      return { acquired: false, lockedBy: lock.agent };
    }
  }

  fileLocks.set(path, { agent, timestamp: Date.now() });
  return { acquired: true };
}

function releaseLock(path) {
  fileLocks.delete(path);
}

function getLockInfo(path) {
  return fileLocks.get(path) || null;
}

export function executeTool(name, args, agentName = "unknown") {
  const projectRoot = getProjectRoot();

  switch (name) {
    case "read_file": {
      const filePath = resolve(projectRoot, args.path);
      if (!existsSync(filePath)) return { error: "File not found" };
      try {
        const content = readFileSync(filePath, "utf-8");
        const lock = getLockInfo(filePath);
        return {
          content,
          locked: !!lock,
          lockedBy: lock?.agent || null,
        };
      } catch (err) {
        return { error: err.message };
      }
    }

    case "write_file": {
      const filePath = resolve(projectRoot, args.path);

      const lockResult = acquireLock(filePath, agentName);
      if (!lockResult.acquired) {
        return {
          error: `File is locked by ${lockResult.lockedBy}`,
          lockedBy: lockResult.lockedBy,
          retry: true,
        };
      }

      try {
        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        // Check if file exists and create backup
        if (existsSync(filePath)) {
          const backupPath = `${filePath}.backup.${Date.now()}`;
          const content = readFileSync(filePath, "utf-8");
          writeFileSync(backupPath, content, "utf-8");
        }

        writeFileSync(filePath, args.content, "utf-8");
        return { success: true, path: args.path };
      } catch (err) {
        return { error: err.message };
      } finally {
        releaseLock(filePath);
      }
    }

    case "merge_file": {
      const filePath = resolve(projectRoot, args.path);

      const lockResult = acquireLock(filePath, agentName);
      if (!lockResult.acquired) {
        return { error: `File is locked by ${lockResult.lockedBy}` };
      }

      try {
        if (!existsSync(filePath)) {
          return { error: "File not found for merging" };
        }

        const currentContent = readFileSync(filePath, "utf-8");
        const newContent = args.content;

        // Simple merge: append new content if different
        if (currentContent === newContent) {
          return { success: true, path: args.path, merged: false, reason: "identical" };
        }

        // Check if new content is already in file
        if (currentContent.includes(newContent.trim())) {
          return { success: true, path: args.path, merged: false, reason: "already_exists" };
        }

        // Append with separator
        const merged = currentContent + "\n\n" + newContent;
        writeFileSync(filePath, merged, "utf-8");

        return { success: true, path: args.path, merged: true };
      } catch (err) {
        return { error: err.message };
      } finally {
        releaseLock(filePath);
      }
    }

    case "list_files": {
      const dirPath = resolve(projectRoot, args.path || ".");
      try {
        const entries = readdirSync(dirPath).map((name) => {
          const stat = statSync(join(dirPath, name));
          const filePath = join(dirPath, name);
          const lock = getLockInfo(filePath);
          return {
            name,
            type: stat.isDirectory() ? "dir" : "file",
            size: stat.size,
            locked: !!lock,
            lockedBy: lock?.agent || null,
          };
        });
        return { files: entries };
      } catch (err) {
        return { error: err.message };
      }
    }

    case "bash": {
      try {
        const output = execSync(args.command, {
          cwd: projectRoot,
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        return { output };
      } catch (err) {
        return { error: err.message, stdout: err.stdout, stderr: err.stderr };
      }
    }

    case "search": {
      try {
        const searchPath = resolve(projectRoot, args.path || ".");
        const output = execSync(
          `rg -n "${args.pattern}" ${searchPath} --max-count 50 2>/dev/null || echo "No matches"`,
          { encoding: "utf-8", timeout: 10000 }
        );
        return { results: output };
      } catch (err) {
        return { results: "No matches found" };
      }
    }

    case "list_locks": {
      const locks = [];
      for (const [path, info] of fileLocks.entries()) {
        locks.push({ path, agent: info.agent, timestamp: info.timestamp });
      }
      return { locks };
    }

    case "release_lock": {
      const filePath = resolve(projectRoot, args.path);
      releaseLock(filePath);
      return { success: true, path: args.path };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
