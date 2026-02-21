import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// ============================================
// Claude API 기본 호출 스크립트
// ============================================
// 사용법:
//   1. .env 파일에 ANTHROPIC_API_KEY 설정
//   2. npx ts-node src/chat.ts
// ============================================

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 대화 히스토리 저장
const conversationHistory: Anthropic.MessageParam[] = [];

// 파일 시스템 상태
let workingFolder: string | null = null;
let lastResponse: string = "";

// ── 헬퍼 함수 ──

/** 작업 폴더 기준으로 파일 경로를 확인한다 */
function resolveFilePath(filename: string): string | null {
  if (!workingFolder) {
    console.log("⚠️  작업 폴더가 설정되지 않았습니다. /folder <경로> 로 설정하세요.");
    return null;
  }
  return path.resolve(workingFolder, filename);
}

/** 파일을 읽어 { content, ext } 를 반환한다. 100KB 초과 시 잘린다. */
function readFileContent(filepath: string): { content: string; ext: string } | null {
  try {
    const MAX_SIZE = 100 * 1024; // 100 KB
    const stat = fs.statSync(filepath);
    let content = fs.readFileSync(filepath, "utf-8");
    const ext = path.extname(filepath).toLowerCase();

    if (stat.size > MAX_SIZE) {
      content = content.slice(0, MAX_SIZE);
      console.log(`⚠️  파일이 100KB를 초과하여 잘렸습니다 (원본 ${(stat.size / 1024).toFixed(1)}KB).`);
    }

    return { content, ext };
  } catch (err: any) {
    console.log(`❌ 파일 읽기 실패: ${err.message}`);
    return null;
  }
}

// 단일 메시지 전송
async function sendMessage(userMessage: string): Promise<string> {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.",
    messages: conversationHistory,
  });

  // 응답 텍스트 추출
  const assistantMessage = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // 히스토리에 어시스턴트 응답 추가
  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  return assistantMessage;
}

// 스트리밍 방식 메시지 전송 (실시간 출력)
async function sendMessageStream(userMessage: string): Promise<string> {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.",
    messages: conversationHistory,
  });

  let fullResponse = "";

  process.stdout.write("\n🤖 Claude: ");

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      fullResponse += event.delta.text;
    }
  }

  console.log("\n");

  conversationHistory.push({
    role: "assistant",
    content: fullResponse,
  });

  return fullResponse;
}

// 인터랙티브 채팅 루프
async function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     Claude API 채팅 데모                      ║");
  console.log("║     종료: quit / exit / q                     ║");
  console.log("║     /clear          히스토리 초기화            ║");
  console.log("║     /folder <경로>  작업 폴더 설정             ║");
  console.log("║     /ls [하위경로]  파일 목록                  ║");
  console.log("║     /read <파일>    파일 읽고 분석 요청        ║");
  console.log("║     /load <파일>    파일을 컨텍스트에 추가     ║");
  console.log("║     /save <파일>    마지막 응답 저장           ║");
  console.log("║     /write <파일>   직접 입력하여 파일 저장    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  const askQuestion = () => {
    rl.question("👤 You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        console.log("👋 대화를 종료합니다.");
        rl.close();
        return;
      }

      if (trimmed === "/clear") {
        conversationHistory.length = 0;
        console.log("🗑️  대화 히스토리가 초기화되었습니다.\n");
        askQuestion();
        return;
      }

      // ── /folder ──
      if (trimmed.startsWith("/folder")) {
        const arg = trimmed.slice("/folder".length).trim();
        if (!arg) {
          console.log(workingFolder ? `📂 현재 작업 폴더: ${workingFolder}` : "⚠️  작업 폴더가 설정되지 않았습니다.");
        } else {
          const resolved = path.resolve(arg);
          if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            workingFolder = resolved;
            console.log(`📂 작업 폴더 설정: ${workingFolder}`);
          } else {
            console.log(`❌ 디렉토리를 찾을 수 없습니다: ${resolved}`);
          }
        }
        console.log();
        askQuestion();
        return;
      }

      // ── /ls ──
      if (trimmed.startsWith("/ls")) {
        const sub = trimmed.slice("/ls".length).trim();
        const target = sub ? resolveFilePath(sub) : workingFolder;
        if (!target) {
          console.log();
          askQuestion();
          return;
        }
        try {
          const entries = fs.readdirSync(target, { withFileTypes: true });
          console.log(`\n📂 ${target}`);
          for (const e of entries) {
            const icon = e.isDirectory() ? "📁" : "📄";
            console.log(`  ${icon} ${e.name}`);
          }
          if (entries.length === 0) console.log("  (빈 폴더)");
        } catch (err: any) {
          console.log(`❌ 목록 조회 실패: ${err.message}`);
        }
        console.log();
        askQuestion();
        return;
      }

      // ── /read ──
      if (trimmed.startsWith("/read ")) {
        const filename = trimmed.slice("/read ".length).trim();
        const filepath = resolveFilePath(filename);
        if (!filepath) { console.log(); askQuestion(); return; }
        const result = readFileContent(filepath);
        if (!result) { console.log(); askQuestion(); return; }
        console.log(`📄 ${filename} 을(를) Claude에게 전송합니다...`);
        const userMsg = `다음은 파일 \`${filename}\` (확장자: ${result.ext || "없음"})의 내용입니다. 이 파일을 분석하고 한국말로 요약해 주세요.\n\n\`\`\`\n${result.content}\n\`\`\``;
        try {
          lastResponse = await sendMessageStream(userMsg);
        } catch (error: any) {
          console.error("❌ 오류 발생:", error.message || error);
          console.log();
        }
        askQuestion();
        return;
      }

      // ── /load ──
      if (trimmed.startsWith("/load ")) {
        const filename = trimmed.slice("/load ".length).trim();
        const filepath = resolveFilePath(filename);
        if (!filepath) { console.log(); askQuestion(); return; }
        const result = readFileContent(filepath);
        if (!result) { console.log(); askQuestion(); return; }
        const contextMsg = `[파일 로드: ${filename} (확장자: ${result.ext || "없음"})]\n\`\`\`\n${result.content}\n\`\`\``;
        conversationHistory.push({ role: "user", content: contextMsg });
        conversationHistory.push({ role: "assistant", content: `파일 \`${filename}\`을(를) 컨텍스트에 로드했습니다.` });
        console.log(`✅ ${filename} 을(를) 컨텍스트에 추가했습니다 (API 호출 없음).\n`);
        askQuestion();
        return;
      }

      // ── /save ──
      if (trimmed.startsWith("/save ")) {
        const filename = trimmed.slice("/save ".length).trim();
        const filepath = resolveFilePath(filename);
        if (!filepath) { console.log(); askQuestion(); return; }
        if (!lastResponse) {
          console.log("⚠️  저장할 응답이 없습니다. 먼저 Claude와 대화하세요.\n");
          askQuestion();
          return;
        }
        try {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          fs.writeFileSync(filepath, lastResponse, "utf-8");
          console.log(`💾 마지막 응답을 저장했습니다: ${filepath}\n`);
        } catch (err: any) {
          console.log(`❌ 파일 저장 실패: ${err.message}\n`);
        }
        askQuestion();
        return;
      }

      // ── /write ──
      if (trimmed.startsWith("/write ")) {
        const filename = trimmed.slice("/write ".length).trim();
        const filepath = resolveFilePath(filename);
        if (!filepath) { console.log(); askQuestion(); return; }
        console.log("📝 내용을 입력하세요 (EOF 만 입력하면 저장):");
        const lines: string[] = [];
        const collectLine = () => {
          rl.question("", (line) => {
            if (line.trim() === "EOF") {
              try {
                fs.mkdirSync(path.dirname(filepath), { recursive: true });
                fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
                console.log(`💾 파일 저장 완료: ${filepath}\n`);
              } catch (err: any) {
                console.log(`❌ 파일 저장 실패: ${err.message}\n`);
              }
              askQuestion();
              return;
            }
            lines.push(line);
            collectLine();
          });
        };
        collectLine();
        return;
      }

      try {
        lastResponse = await sendMessageStream(trimmed);
      } catch (error: any) {
        if (error.status === 401) {
          console.error("❌ API 키가 유효하지 않습니다. .env 파일을 확인하세요.");
        } else if (error.status === 429) {
          console.error("❌ API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.");
        } else {
          console.error("❌ 오류 발생:", error.message || error);
        }
        console.log();
      }

      askQuestion();
    });
  };

  askQuestion();
}

// 실행
startChat();