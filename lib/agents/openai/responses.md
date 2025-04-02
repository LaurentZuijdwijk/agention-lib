standard response:

{
  "id":"chatcmpl-BChrPZUYrvPf96DNuy4WUBhboq2Fx",
  "object":"chat.completion",
  "created":1742368235,
  "model":"gpt-4o-mini-2024-07-18",
  "choices":[
    {"index":0,
    "message":{
      "role":"assistant",
      "content":null,
      "tool_calls":[{"id":"call_8VcNrODWpA3hVJRfyidbAx1m","type":"function","function":{"name":"geocodingTool","arguments":"{\"term\":\"London\"}"}}],"refusal":null,"annotations":[]},"logprobs":null,"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":229,"completion_tokens":17,"total_tokens":246,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}},"service_tier":"default","system_fingerprint":"fp_3267753c5d"}


with tool call
 {
  "id":"chatcmpl-BChrPZUYrvPf96DNuy4WUBhboq2Fx",
  "object":"chat.completion",
  "created":1742368235,
  "model":"gpt-4o-mini-2024-07-18",
  "choices":[
  {
    "index":0,
    "message":{
      "role":"assistant",
      "content":null,
      "tool_calls":[
        {
          "id":"call_8VcNrODWpA3hVJRfyidbAx1m",
          "type":"function",
          "function":{"name":"geocodingTool","arguments":"{\"term\":\"London\"}"}
        }
      ],
      "refusal":null,
      "annotations":[]
    },
  "logprobs":null,
  "finish_reason":"tool_calls"
  }
  ],
 "usage":{
   "prompt_tokens":229,
   "completion_tokens":17,
   "total_tokens":246,
   "prompt_tokens_details":{
     "cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}},"service_tier":"default","system_fingerprint":"fp_3267753c5d"}



 response stop {
   id: 'chatcmpl-BDT8XYerJYmKIzK40mljamMtmBGAY',
   object: 'chat.completion',
   created: 1742549965,
   model: 'gpt-4o-mini-2024-07-18',
   choices: [
     {
       index: 0,
       message: [Object],
       logprobs: null,
       finish_reason: 'stop'
     }
   ],
   usage: {
     prompt_tokens: 3406,
     completion_tokens: 347,
     total_tokens: 3753,
     prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 },
     completion_tokens_details: {
       reasoning_tokens: 0,
       audio_tokens: 0,
       accepted_prediction_tokens: 0,
       rejected_prediction_tokens: 0
     }
   },
   service_tier: 'default',
   system_fingerprint: 'fp_e4fa3702df'
 }
