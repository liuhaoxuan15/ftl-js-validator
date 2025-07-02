// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as acorn from 'acorn';

// 创建输出通道
const outputChannel = vscode.window.createOutputChannel('FTL JS Validator');

// 创建诊断集合
const diagnosticCollection = vscode.languages.createDiagnosticCollection('ftl-js-validator');

export function activate(context: vscode.ExtensionContext) {
    outputChannel.appendLine('扩展已激活');

    // 注册命令
    const checkSyntaxCommand = vscode.commands.registerCommand('ftl-js-validator.checkSyntax', () => {
        outputChannel.show(true);  // 显示输出面板
        outputChannel.appendLine('命令被触发');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有打开的编辑器');
            return;
        }
        
        outputChannel.appendLine(`文件类型: ${editor.document.languageId}`);
        outputChannel.appendLine(`文件路径: ${editor.document.fileName}`);
        
        if (editor.document.languageId === 'ftl') {
            validateFtlDocument(editor.document);
        } else {
            vscode.window.showErrorMessage('当前文件不是 .ftl 文件');
        }
    });

    context.subscriptions.push(checkSyntaxCommand);
}


function validateFtlDocument(document: vscode.TextDocument) {
    // 显示并清空输出面板
    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine('=======================================');
    outputChannel.appendLine(`开始验证文件: ${document.fileName}`);
    outputChannel.appendLine('=======================================\n');
    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    // 清除之前的诊断信息
    diagnosticCollection.delete(document.uri);

    // 正则表达式匹配 FTL 中的 JavaScript 代码块
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    let hasError = false;
    
    outputChannel.appendLine(`文件内容长度: ${text.length} 字符`);
    
    while ((match = scriptRegex.exec(text)) !== null) {
        const jsCode = match[1].trim();
        if (!jsCode) {
            outputChannel.appendLine('跳过空的脚本块');
            continue;
        }
        
        // outputChannel.appendLine(`\n发现脚本块:\n${jsCode}\n`);
        const scriptStartIndex = match.index + match[0].indexOf(jsCode);
        
        try {
            // 使用 acorn 解析 JavaScript 代码
            acorn.parse(jsCode, {
                ecmaVersion: 'latest',
                sourceType: 'module'
            });
            outputChannel.appendLine('语法检查通过');
        } catch (e: any) {
            hasError = true;
            const errorPos = scriptStartIndex + (e.pos || 0);
            const errorLine = document.positionAt(errorPos);
            
            // 在输出面板中显示详细错误信息，包含可点击的链接
            const fileLink = `${document.uri.fsPath}:${errorLine.line + 1}:${errorLine.character + 1}`;
            outputChannel.appendLine('\n发现错误:');
            outputChannel.appendLine('----------------------------------------');
            outputChannel.appendLine(`错误类型: JavaScript 语法错误`);
            outputChannel.appendLine(`错误位置: ${fileLink}`);  // VS Code 会自动将文件路径转换为可点击的链接
            outputChannel.appendLine(`错误信息: ${e.message}`);
            outputChannel.appendLine(`错误代码: ${document.lineAt(errorLine.line).text.trim()}`);
            outputChannel.appendLine('----------------------------------------\n');
            
            // 获取整行文本用于显示上下文
            const lineText = document.lineAt(errorLine.line).text;
            
            // 创建范围，高亮整行错误代码
            const range = new vscode.Range(
                errorLine.line,
                0,
                errorLine.line,
                lineText.length
            );
            
            // 创建诊断信息
            const diagnostic = new vscode.Diagnostic(
                range,
                `JavaScript 语法错误: ${e.message}`,
                vscode.DiagnosticSeverity.Error
            );
            
            diagnostic.source = 'FTL JS Validator';
            diagnostic.code = 'js-syntax-error';
            
            // 设置简洁的错误信息
            diagnostic.message = `JavaScript 语法错误: ${e.message}`;
            
            // 添加相关位置信息
            // diagnostic.relatedInformation = [
            //     new vscode.DiagnosticRelatedInformation(
            //         new vscode.Location(document.uri, range),
            //         `错误行`
            //     )
            // ];
            
            diagnostics.push(diagnostic);
        }
    }

    // 更新诊断信息
    if (diagnostics.length > 0) {
        diagnosticCollection.set(document.uri, diagnostics);
        vscode.window.showErrorMessage(`发现 ${diagnostics.length} 个 JavaScript 语法错误`);
    } else if (!hasError) {
        vscode.window.showInformationMessage('未发现 JavaScript 语法错误');
    }
}

export function deactivate() {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
}
