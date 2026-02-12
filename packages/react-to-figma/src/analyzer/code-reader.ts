import { glob } from "glob";
import { readFileSync } from "fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolve, relative } from "path";

// Handle default export differences between CJS/ESM
const traverse =
  typeof _traverse === "function"
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

export interface ComponentUsage {
  name: string;
  props: Record<string, string | boolean | undefined>;
  children?: string;
  sourceFile: string;
  line: number;
}

export interface CodeAnalysis {
  /** Concatenated relevant source code (truncated to maxBytes) */
  sourceCode: string;
  /** Detected shadcn component usages */
  componentUsages: ComponentUsage[];
  /** List of files analyzed */
  files: string[];
}

const SHADCN_IMPORT_PATTERNS = [
  /from\s+["']@\/components\/ui\//,
  /from\s+["']~\/components\/ui\//,
  /from\s+["']\.\.?\/components\/ui\//,
];

const MAX_SOURCE_BYTES = 50 * 1024; // 50KB limit for Claude context

export async function readProjectCode(
  projectPath: string,
): Promise<CodeAnalysis> {
  const absPath = resolve(projectPath);

  const files = await glob("**/*.{tsx,jsx}", {
    cwd: absPath,
    ignore: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      ".git/**",
      "*.test.*",
      "*.spec.*",
    ],
    absolute: true,
  });

  const componentUsages: ComponentUsage[] = [];
  const relevantFiles: string[] = [];
  let totalSource = "";

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const relPath = relative(absPath, file);

    // Check if file imports shadcn components
    const hasShadcnImport = SHADCN_IMPORT_PATTERNS.some((p) => p.test(content));

    if (hasShadcnImport) {
      relevantFiles.push(relPath);

      // Extract component usages via AST
      try {
        const usages = extractComponentUsages(content, relPath);
        componentUsages.push(...usages);
      } catch {
        // If AST parsing fails, still include the source
      }

      // Append source with file header
      const fileSection = `\n// --- ${relPath} ---\n${content}\n`;
      if (totalSource.length + fileSection.length <= MAX_SOURCE_BYTES) {
        totalSource += fileSection;
      }
    }
  }

  // If no shadcn files found, include page/layout files
  if (relevantFiles.length === 0) {
    for (const file of files) {
      const relPath = relative(absPath, file);
      if (
        relPath.includes("page.") ||
        relPath.includes("layout.") ||
        relPath.includes("App.") ||
        relPath.includes("index.")
      ) {
        const content = readFileSync(file, "utf-8");
        relevantFiles.push(relPath);
        const fileSection = `\n// --- ${relPath} ---\n${content}\n`;
        if (totalSource.length + fileSection.length <= MAX_SOURCE_BYTES) {
          totalSource += fileSection;
        }
      }
    }
  }

  return {
    sourceCode: totalSource,
    componentUsages,
    files: relevantFiles,
  };
}

function extractComponentUsages(
  code: string,
  filePath: string,
): ComponentUsage[] {
  const usages: ComponentUsage[] = [];

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
  });

  // Collect shadcn import names
  const shadcnImports = new Set<string>();

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (
        source.includes("/components/ui/") ||
        source.startsWith("@/components/ui/") ||
        source.startsWith("~/components/ui/")
      ) {
        for (const spec of path.node.specifiers) {
          if (
            spec.type === "ImportSpecifier" ||
            spec.type === "ImportDefaultSpecifier"
          ) {
            shadcnImports.add(spec.local.name);
          }
        }
      }
    },
  });

  if (shadcnImports.size === 0) return usages;

  traverse(ast, {
    JSXOpeningElement(path) {
      const nameNode = path.node.name;
      let name: string | undefined;

      if (nameNode.type === "JSXIdentifier") {
        name = nameNode.name;
      } else if (
        nameNode.type === "JSXMemberExpression" &&
        nameNode.object.type === "JSXIdentifier"
      ) {
        name = `${nameNode.object.name}.${nameNode.property.name}`;
      }

      if (!name || !shadcnImports.has(name.split(".")[0])) return;

      const props: Record<string, string | boolean | undefined> = {};
      for (const attr of path.node.attributes) {
        if (
          attr.type === "JSXAttribute" &&
          attr.name.type === "JSXIdentifier"
        ) {
          const propName = attr.name.name;
          if (!attr.value) {
            props[propName] = true;
          } else if (attr.value.type === "StringLiteral") {
            props[propName] = attr.value.value;
          } else if (
            attr.value.type === "JSXExpressionContainer" &&
            attr.value.expression.type === "StringLiteral"
          ) {
            props[propName] = attr.value.expression.value;
          }
        }
      }

      // Try to extract text children
      const parent = path.parentPath;
      let children: string | undefined;
      if (parent.node.type === "JSXElement") {
        const childTexts: string[] = [];
        for (const child of (parent.node as any).children) {
          if (child.type === "JSXText") {
            const text = child.value.trim();
            if (text) childTexts.push(text);
          } else if (
            child.type === "JSXExpressionContainer" &&
            child.expression.type === "StringLiteral"
          ) {
            childTexts.push(child.expression.value);
          }
        }
        if (childTexts.length > 0) {
          children = childTexts.join(" ");
        }
      }

      usages.push({
        name,
        props,
        children,
        sourceFile: filePath,
        line: path.node.loc?.start.line ?? 0,
      });
    },
  });

  return usages;
}
