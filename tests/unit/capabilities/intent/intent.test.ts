/**
 * @file tests/unit/capabilities/intent/intent.test.ts
 * @description 意图识别测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { IntentRecognizer, recognizeIntent } from '@/capabilities/intent';

describe('IntentRecognizer', () => {
  let recognizer: IntentRecognizer;

  beforeEach(() => {
    recognizer = new IntentRecognizer();
  });

  describe('Basic Recognition', () => {
    it('should recognize code intent', () => {
      const result = recognizer.recognize('帮我写一个 Python 函数');
      
      expect(result.primary).toBe('code');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.entities).toBeDefined();
      expect(result.keywords).toContain('python');
      expect(result.keywords).toContain('函数');
    });

    it('should recognize analysis intent', () => {
      const result = recognizer.recognize('分析这段代码的问题');
      
      expect(result.primary).toBe('analysis');
      expect(result.requiredCapabilities).toContain('data-analysis');
    });

    it('should recognize search intent', () => {
      const result = recognizer.recognize('搜索相关的文档');
      
      expect(result.primary).toBe('search');
    });

    it('should recognize creation intent', () => {
      const result = recognizer.recognize('创建一个配置文件');
      
      expect(result.primary).toBe('creation');
    });

    it('should recognize debugging intent', () => {
      const result = recognizer.recognize('调试这个错误');
      
      expect(result.primary).toBe('debugging');
    });

    it('should recognize learning intent', () => {
      const result = recognizer.recognize('学习如何使用这个工具');
      
      expect(result.primary).toBe('learning');
    });
  });

  describe('Intent Properties', () => {
    it('should return all required fields', () => {
      const result = recognizer.recognize('测试输入');
      
      expect(result.primary).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(Array.isArray(result.requiredCapabilities)).toBe(true);
      expect(result.rawInput).toBe('测试输入');
    });

    it('should extract keywords', () => {
      const result = recognizer.recognize('使用 Docker 部署 Node.js 应用');
      
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.keywords.some(k => k.includes('docker'))).toBe(true);
    });

    it('should extract file path entities', () => {
      const result = recognizer.recognize('分析 src/index.ts 文件');
      
      const fileEntity = result.entities.find(e => e.type === 'file_path');
      expect(fileEntity).toBeDefined();
      expect(fileEntity?.value).toContain('index.ts');
    });

    it('should extract URL entities', () => {
      const result = recognizer.recognize('访问 https://example.com/api');
      
      const urlEntity = result.entities.find(e => e.type === 'url');
      expect(urlEntity).toBeDefined();
      expect(urlEntity?.value).toBe('https://example.com/api');
    });
  });

  describe('Required Capabilities', () => {
    it('should infer code capabilities', () => {
      const result = recognizer.recognize('写代码');
      
      expect(result.requiredCapabilities).toContain('code-generation');
    });

    it('should infer Docker capabilities', () => {
      const result = recognizer.recognize('使用 Docker');
      
      expect(result.requiredCapabilities).toContain('docker');
    });

    it('should infer Git capabilities', () => {
      const result = recognizer.recognize('提交 git commit');
      
      expect(result.requiredCapabilities).toContain('git');
    });

    it('should infer database capabilities', () => {
      const result = recognizer.recognize('查询数据库');
      
      expect(result.requiredCapabilities).toContain('database');
    });
  });

  describe('Batch Recognition', () => {
    it('should recognize multiple inputs', () => {
      const inputs = [
        '写代码',
        '分析数据',
        '搜索文档',
      ];

      const results = recognizer.recognizeBatch(inputs);

      expect(results).toHaveLength(3);
      expect(results[0].primary).toBe('code');
      expect(results[1].primary).toBe('analysis');
      expect(results[2].primary).toBe('search');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have higher confidence for clear intent', () => {
      const codeResult = recognizer.recognize('写代码实现功能');
      const chatResult = recognizer.recognize('你好');

      expect(codeResult.confidence).toBeGreaterThan(chatResult.confidence);
    });

    it('should return confidence between 0 and 1', () => {
      const result = recognizer.recognize('一些输入');
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Convenience Function', () => {
    it('should work with convenience function', () => {
      const result = recognizeIntent('写 Python 脚本');
      
      expect(result.primary).toBe('code');
      expect(result.rawInput).toBe('写 Python 脚本');
    });

    it('should accept options', () => {
      const result = recognizeIntent('测试', {
        minConfidence: 0.8,
        extractEntities: true,
      });
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});
