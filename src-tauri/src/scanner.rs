use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// 默认忽略列表
const DEFAULT_IGNORE_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "out",
    "output",
    ".git",
    ".svn",
    ".hg",
    ".idea",
    ".vscode",
    ".vs",
    "__pycache__",
    ".pytest_cache",
    "target",
    "bin",
    "obj",
    "vendor",
    "bower_components",
    ".next",
    ".nuxt",
    ".output",
    "coverage",
    ".nyc_output",
    ".gradle",
    ".mvn",
    ".cache",
    ".tmp",
];

const DEFAULT_IGNORE_EXTENSIONS: &[&str] = &[
    "min.js", "min.css", "map", "lock", "exe", "dll", "so", "dylib", "o", "a", "png", "jpg",
    "jpeg", "gif", "svg", "ico", "bmp", "webp", "mp3", "mp4", "avi", "mov", "wav", "flac", "zip",
    "tar", "gz", "rar", "7z", "bz2", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "woff",
    "woff2", "ttf", "eot", "otf", "sqlite", "db", "mdb", "pyc", "pyo", "class",
];

const DEFAULT_IGNORE_FILES: &[&str] = &[
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
];

/// 扩展名到语言的映射
fn ext_to_language(ext: &str) -> &'static str {
    match ext {
        "js" => "JavaScript",
        "jsx" => "JavaScript (JSX)",
        "ts" => "TypeScript",
        "tsx" => "TypeScript (TSX)",
        "vue" => "Vue",
        "svelte" => "Svelte",
        "java" => "Java",
        "py" => "Python",
        "c" => "C",
        "h" => "C/C++ Header",
        "cpp" | "cc" | "cxx" => "C++",
        "hpp" => "C++ Header",
        "cs" => "C#",
        "go" => "Go",
        "rs" => "Rust",
        "rb" => "Ruby",
        "php" => "PHP",
        "swift" => "Swift",
        "kt" | "kts" => "Kotlin",
        "scala" => "Scala",
        "dart" => "Dart",
        "lua" => "Lua",
        "r" | "R" => "R",
        "m" => "Objective-C",
        "mm" => "Objective-C++",
        "pl" | "pm" => "Perl",
        "sh" | "bash" | "zsh" => "Shell",
        "bat" | "cmd" => "Batch",
        "ps1" => "PowerShell",
        "sql" => "SQL",
        "html" | "htm" => "HTML",
        "css" => "CSS",
        "scss" => "SCSS",
        "sass" => "Sass",
        "less" => "Less",
        "xml" => "XML",
        "json" => "JSON",
        "yaml" | "yml" => "YAML",
        "toml" => "TOML",
        "md" => "Markdown",
        "txt" => "Text",
        "gradle" | "groovy" => "Groovy",
        "ex" | "exs" => "Elixir",
        "erl" | "hrl" => "Erlang",
        "hs" => "Haskell",
        "ml" => "OCaml",
        "fs" | "fsx" => "F#",
        "clj" | "cljs" => "Clojure",
        "proto" => "Protocol Buffers",
        "graphql" | "gql" => "GraphQL",
        "tf" => "Terraform",
        "wxss" => "WXSS",
        "wxml" => "WXML",
        "wxs" => "WXS",
        "prisma" => "Prisma",
        "astro" => "Astro",
        _ => "Unknown",
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTypeInfo {
    pub ext: String,
    pub language: String,
    pub count: usize,
    pub total_size: u64,
}

/// 解析 .gitignore 文件
fn parse_gitignore(dir_path: &Path) -> Vec<String> {
    let gitignore_path = dir_path.join(".gitignore");
    if !gitignore_path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&gitignore_path) {
        Ok(content) => content
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// 检查路径是否应被忽略
fn should_ignore(
    relative_path: &Path,
    file_name: &str,
    custom_ignore: &[String],
    gitignore_patterns: &[String],
) -> bool {
    // 检查默认忽略目录
    for component in relative_path.components() {
        let comp_str = component.as_os_str().to_string_lossy();
        if DEFAULT_IGNORE_DIRS
            .iter()
            .any(|d| *d == comp_str.as_ref() as &str)
        {
            return true;
        }
    }

    // 检查默认忽略文件
    if DEFAULT_IGNORE_FILES.iter().any(|f| *f == file_name) {
        return true;
    }

    // 检查扩展名
    if let Some(ext) = relative_path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        if DEFAULT_IGNORE_EXTENSIONS
            .iter()
            .any(|e| *e == ext_str.as_str())
        {
            return true;
        }
        // 检查 .min.js / .min.css
        let name_lower = file_name.to_lowercase();
        if name_lower.ends_with(".min.js") || name_lower.ends_with(".min.css") {
            return true;
        }
    }

    // 检查自定义忽略模式
    let rel_str = relative_path.to_string_lossy();
    for pattern in custom_ignore.iter().chain(gitignore_patterns.iter()) {
        let pattern = pattern.trim_end_matches('/');
        // 简单目录名匹配
        if !pattern.contains('*') && !pattern.contains('/') {
            for component in relative_path.components() {
                if component.as_os_str().to_string_lossy() == pattern {
                    return true;
                }
            }
            if file_name == pattern {
                return true;
            }
        }
        // glob 匹配
        if let Ok(glob_pattern) = glob::Pattern::new(pattern) {
            if glob_pattern.matches(&rel_str) || glob_pattern.matches(file_name) {
                return true;
            }
        }
    }

    false
}

/// 扫描目录并返回文件列表
pub fn scan_dir(dir_path: &str, custom_ignore: &[String], use_gitignore: bool) -> Vec<FileInfo> {
    let base_path = Path::new(dir_path);
    if !base_path.exists() || !base_path.is_dir() {
        return Vec::new();
    }

    let gitignore_patterns = if use_gitignore {
        parse_gitignore(base_path)
    } else {
        Vec::new()
    };

    let mut files = Vec::new();

    for entry in WalkDir::new(base_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let full_path = entry.path();
        let relative_path = match full_path.strip_prefix(base_path) {
            Ok(p) => p,
            Err(_) => continue,
        };

        let file_name = match entry.file_name().to_str() {
            Some(n) => n,
            None => continue,
        };

        if should_ignore(relative_path, file_name, custom_ignore, &gitignore_patterns) {
            continue;
        }

        let ext = relative_path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();

        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let language = ext_to_language(&ext).to_string();

        files.push(FileInfo {
            path: full_path.to_string_lossy().replace('\\', "/"),
            relative_path: relative_path.to_string_lossy().replace('\\', "/"),
            name: file_name.to_string(),
            ext: if ext.is_empty() {
                String::new()
            } else {
                format!(".{}", ext)
            },
            size,
            language,
        });
    }

    // 按相对路径排序
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    files
}

/// 检测文件类型分布
pub fn detect_types(
    dir_paths: &[String],
    custom_ignore: &[String],
    use_gitignore: bool,
) -> Vec<FileTypeInfo> {
    let mut type_map: HashMap<String, FileTypeInfo> = HashMap::new();

    for dir_path in dir_paths {
        let files = scan_dir(dir_path, custom_ignore, use_gitignore);
        for file in files {
            if file.ext.is_empty() {
                continue;
            }
            let entry = type_map.entry(file.ext.clone()).or_insert(FileTypeInfo {
                ext: file.ext.clone(),
                language: file.language.clone(),
                count: 0,
                total_size: 0,
            });
            entry.count += 1;
            entry.total_size += file.size;
        }
    }

    let mut types: Vec<FileTypeInfo> = type_map.into_values().collect();
    types.sort_by(|a, b| b.count.cmp(&a.count));
    types
}

/// 读取文件内容，处理编码
pub fn read_file_content(file_path: &str) -> Result<String, String> {
    let bytes = fs::read(file_path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 尝试 UTF-8
    if let Ok(content) = std::str::from_utf8(&bytes) {
        return Ok(content.to_string());
    }

    // 使用 encoding_rs 检测和转换
    // 尝试常见中文编码
    let encodings = [
        encoding_rs::GBK,
        encoding_rs::GB18030,
        encoding_rs::BIG5,
        encoding_rs::UTF_16LE,
        encoding_rs::UTF_16BE,
        encoding_rs::SHIFT_JIS,
        encoding_rs::EUC_KR,
    ];

    for encoding in encodings {
        let (decoded, _, had_errors) = encoding.decode(&bytes);
        if !had_errors {
            return Ok(decoded.to_string());
        }
    }

    // 强制使用 GBK 解码
    let (decoded, _, _) = encoding_rs::GBK.decode(&bytes);
    Ok(decoded.to_string())
}
