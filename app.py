import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

# 加载当前目录下的 .env 文件
load_dotenv()

app = Flask(__name__)
CORS(app)

# 初始化 OpenAI 客户端 (适配 Claude Opus)
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)
MODEL = os.getenv("MODEL_STEP")

@app.route('/analyze_note', methods=['POST'])
def analyze_note():
    """
    深度分析单篇笔记及其评论区
    """
    data = request.get_json()
    note_data = data.get('note_data', {})
    user_question = data.get('user_question', '')

    prompt = f"""
你是一位中立的小红书内容调研记录员。请根据以下笔记的正文及评论区内容，围绕用户的【搜索关键词】进行客观的深度分析。

### 约束条件：
1. **核心原则**：请**围绕用户搜索的关键词**提取信息。如果笔记内容与关键词无关，请在摘要中明确说明，不要做无关的总结。
2. **严禁提供任何主观建议**（如“我建议”、“你应该”等）。
3. **必须严格溯源**：提取观点或结论时，必须标注来源。格式为：`[用户昵称]：观点内容`。
4. **保持客观**：仅搬运和整合笔记及评论区中已有的信息。

### 用户搜索的关键词：
{user_question}

### 笔记详情：
- 标题：{note_data.get('title')}
- 作者：{note_data.get('author')}
- 链接：{note_data.get('url')}
- 正文内容：{note_data.get('content')}

### 评论及回复内容：
{note_data.get('comments_text')}

### 你的任务：
请将分析结果整理为**两个完整的段落**，严禁使用列表或项目符号：
- **第一段**：核心观点搬运。描述这篇笔记正文针对用户问题提供了哪些具体信息，并标注作者昵称。
- **第二段**：舆论场整合。描述评论区对笔记内容的反馈（支持、质疑、补充），整合评论区中提到的真实避雷点或额外技巧，并标注发言用户昵称。同时识别出评论区中发言中肯、专业且积极互动的优质用户。

请确保输出为纯文本段落，字数控制在 300 字以内。
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        result = response.choices[0].message.content
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/generate_report', methods=['POST'])
def generate_report():
    """
    基于选中的全量原始数据，生成最终调研报告
    """
    data = request.get_json()
    selected_data = data.get('selected_data', [])
    user_question = data.get('user_question', '')

    # 构建全量上下文
    context_parts = []
    for item in selected_data:
        part = f"""
笔记标题：{item.get('title')}
作者：{item.get('author')}
链接：{item.get('url')}
正文：{item.get('content')}
评论区：{item.get('comments_text')}
"""
        context_parts.append(part)
    
    full_context = "\n\n===\n\n".join(context_parts)

    prompt = f"""
你是一位资深的调研专家。请基于以下多篇小红书笔记及其评论区的【全量原始数据】，生成一份最终的【小红书深度调研报告】。

### 约束条件：
1. **严禁提供任何主观建议**。
2. **必须严格溯源**：所有结论和观点必须标注来源（作者昵称或评论用户昵称）。

### 调研主题：
{user_question}

### 原始数据上下文：
{full_context}

### 报告要求：
1. **核心结论汇总**：基于所有原始数据，直接回答用户的问题，给出客观的结论汇总。
2. **深度观点碰撞**：
   - 总结多篇笔记和评论区达成的共识（标注来源）。
   - 详细标注出存在的争议点或不同的声音（标注来源）。
3. **全量避雷指南**：汇总评论区中提到的所有负面反馈、注意事项和避坑经验（标注来源）。
4. **优质用户推荐**：
   - 列出在评论区中表现专业、中肯且积极互动的优质用户。
   - 提示用户可以针对性地私信这些用户。
5. **引用来源列表**：列出参考的笔记标题及链接。

请使用 Markdown 格式输出，确保条理清晰，语言专业且易读。
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        report = response.choices[0].message.content
        return jsonify({"report": report})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
