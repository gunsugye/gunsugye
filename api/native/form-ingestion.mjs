import {planFormResponses} from './form-reconciliation.mjs';

// This is a preparation-only adapter. store.enqueue and store.enqueueReview must
// each atomically insert with a unique (formId,responseId,submittedAt) key.
// They must return 'inserted' or 'duplicate'; a failure must reject the call.
// Do not advance a synchronization cursor from this function: Google may deliver
// updates out of order, and a caller must not lose responses after a partial run.
export async function collectFormBatch({client,store,formId,people,items}){
 if(!client?.form||!client?.responses||!store?.enqueue||!store?.enqueueReview||!formId)throw Error('폼 수집 연결을 확인하세요.');
 const [form,responses]=await Promise.all([client.form(formId),client.responses(formId)]);
 const questions={};for(const item of form.items||[]){const id=item.questionItem?.question?.questionId;if(!id)continue;if(questions[id])throw Error('폼 질문 ID가 중복됩니다.');questions[id]=item.title;}
 const {receipts,review}=planFormResponses({formId,responses,questions,people,items});
 if(review.some(r=>!r.responseId||!r.submittedAt))throw Error('식별자 또는 제출 시각이 없는 응답을 확인하세요.');
 const result={read:responses.length,queued:0,review:0,duplicates:0};
 // Sequential writes allow a failure to stop the run; repeating the complete
 // batch is safe only if the persistent store enforces the unique key.
 for(const record of receipts){const status=await store.enqueue(record);if(status==='inserted')result.queued++;else if(status==='duplicate')result.duplicates++;else throw Error('폼 접수 저장 결과를 확인하세요.');}
 for(const record of review){const status=await store.enqueueReview({formId,...record});if(status==='inserted')result.review++;else if(status==='duplicate')result.duplicates++;else throw Error('폼 검토 저장 결과를 확인하세요.');}
 return result;
}
