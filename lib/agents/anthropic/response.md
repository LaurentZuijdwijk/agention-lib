
{
  id: 'msg_01Cd7XD8z8WGXfJXusJmmrzh',
  type: 'message',
  role: 'assistant',
  model: 'claude-3-5-haiku-20241022',
  content: [
    {
      type: 'text',
      text: "I'll help you find the weather forecast for London. I'll first use the geocoding tool to get the precise coordinates, and then retrieve the weather information."
    },
    {
      type: 'tool_use',
      id: 'toolu_01E3KdzVRbxWL6HkMLJm6jFq',
      name: 'geocodingTool',
      input: [Object]
    }
  ],
  stop_reason: 'tool_use',
  stop_sequence: null,
  usage: {
    input_tokens: 711,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 88
  }
}

{
  id: 'msg_01NnE7iYDNKzaWBrqP8KFpQR',
  type: 'message',
  role: 'assistant',
  model: 'claude-3-5-haiku-20241022',
  content: [
    {
      type: 'text',
      text: "Now, I'll use the coordinates for London, UK to get the weather forecast:"
    },
    {
      type: 'tool_use',
      id: 'toolu_0186yhUCDw6W8uxrZvk742hF',
      name: 'weatherTool',
      input: [Object]
    }
  ],
  stop_reason: 'tool_use',
  stop_sequence: null,
  usage: {
    input_tokens: 2247,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 96
  }
}

{
  id: 'msg_01HRK1szbbU4XarLJNbkiUth',
  type: 'message',
  role: 'assistant',
  model: 'claude-3-5-haiku-20241022',
  content: [
    {
      type: 'text',
      text: '<tooluse>geocodingTool, weatherTool</tooluse>\n' +
        '<result>{\n' +
        '  textContent: "Mild spring day in London with moderate winds. Expect a cool temperature with a light breeze.",\n' +
        '  currentTempinC: 12.6,\n' +
        '  currentWind: 11.5,\n' +
        "  currentPrecip: 'None'\n" +
        '}</result>'
    }
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 5775,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 91
  }
}
