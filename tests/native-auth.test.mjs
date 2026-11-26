import test from 'node:test';
import assert from 'node:assert/strict';
import {validateClient,validateState,validateGrant,redirectUri,scopes} from '../scripts/google-native-auth.mjs';
test('server Google setup accepts only the designated project and loopback callback',()=>{
 const web={project_id:'gunsugyedaily',client_id:'client.apps.googleusercontent.com',client_secret:'private',redirect_uris:[redirectUri]};
 assert.equal(validateClient({web}),web);
 assert.throws(()=>validateClient({web:{...web,project_id:'other'}}));
 assert.throws(()=>validateClient({web:{...web,redirect_uris:['https://other.example']}}));
 assert.throws(()=>validateClient({installed:web}));
});
test('server Google setup rejects forged state, wrong accounts, and incomplete consent',()=>{
 assert.equal(validateState(new URL(redirectUri+'?state=correct'),'correct'),true);
 assert.equal(validateState(new URL(redirectUri+'?state=invalid'),'correct'),false);
 const profile={email:'gunsugye@gmail.com',email_verified:true},tokens={refresh_token:'private'};
 validateGrant(profile,scopes,tokens);
 assert.throws(()=>validateGrant({...profile,email:'other@gmail.com'},scopes,tokens));
 assert.throws(()=>validateGrant({...profile,email_verified:false},scopes,tokens));
 assert.throws(()=>validateGrant(profile,scopes.slice(0,-1),tokens));
 assert.throws(()=>validateGrant(profile,scopes,{}));
});
