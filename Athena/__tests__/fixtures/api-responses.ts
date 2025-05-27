// API Response Fixtures

export const mockOpenAIResponse = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1677652288,
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This file appears to be a trojan with ransomware capabilities.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
};

export const mockClaudeResponse = {
  id: 'msg_123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'Analysis complete. Detected malicious behavior patterns.',
    },
  ],
  model: 'claude-3-opus-20240229',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
  },
};

export const mockDeepseekResponse = {
  id: 'cmpl-123',
  object: 'chat.completion',
  created: 1677652288,
  model: 'deepseek-coder',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Code deobfuscation complete. Original functionality revealed.',
      },
      finish_reason: 'stop',
    },
  ],
};

export const mockMetasploitResponse = {
  vulnerabilities: [
    {
      module: 'exploit/windows/smb/ms17_010_eternalblue',
      cve: 'CVE-2017-0144',
      severity: 'critical',
      description: 'SMB Remote Code Execution Vulnerability',
      affected_versions: ['Windows 7', 'Windows Server 2008'],
    },
  ],
  total_found: 1,
  scan_time: '2.5s',
};

export const mockContainerApiResponse = {
  id: 'container-123',
  status: 'running',
  ip_address: '172.17.0.2',
  ports: [],
  created_at: new Date().toISOString(),
  metrics: {
    cpu_usage: 15.5,
    memory_usage: 512,
    disk_usage: 1024,
  },
};