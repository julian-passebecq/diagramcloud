import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRefSchema,receiptLevel,validateVerificationReceipt,verificationReceipt,type ReceiptCheck} from '../src/core/galaxy';

const commit='a9e2f4a51f187056b0ff286ddc4c25023762a762';
const pass=(...ids:string[]):ReceiptCheck[]=>ids.map(check_id=>({check_id,status:'passed'}));
const base={productVersion:'1.0.0-rc.1',documentSchemaVersion:1,repository:'julian-passebecq/diagramcloud',commit,dirty:false,createdAt:new Date('2026-10-05T10:00:00Z')};

test('the receipt level is the highest level whose every check passed, never inferred upward',()=>{
 assert.equal(receiptLevel([]),'DECLARED');
 assert.equal(receiptLevel(pass('typecheck')),'IMPLEMENTED');
 assert.equal(receiptLevel(pass('typecheck','unit','build')),'BUILD_VERIFIED');
 // e2e passed but no package check: E2E is not reached by skipping PACKAGE.
 assert.equal(receiptLevel(pass('typecheck','unit','build','e2e')),'BUILD_VERIFIED');
 assert.equal(receiptLevel(pass('typecheck','unit','build','package','e2e')),'E2E_VERIFIED');
 assert.equal(receiptLevel([...pass('typecheck','unit','package','e2e'),{check_id:'build',status:'failed'}]),'IMPLEMENTED');
});

test('a full automated run produces an E2E_VERIFIED receipt for one exact commit, at Galaxy maturity G0',()=>{
 const r=verificationReceipt({...base,checks:pass('typecheck','unit','build','package','e2e')});
 assert.equal(r.verification_level,'E2E_VERIFIED');
 assert.equal(r.status,'passed');
 assert.equal(r.galaxy_level,'G0');
 assert.equal(r.app_id,'diagramcloud');
 assert.equal(r.subject.owner_app,'diagramcloud');
 assert.equal(r.revision.commit,commit);
 assert.equal(r.product_version,'1.0.0-rc.1');
 assert.equal(r.document_schema_version,1);
 assert(r.caveats.some(c=>/GALAXY_QUALIFIED/.test(c)));
});

test('a failed check makes the receipt failed and caps the level',()=>{
 const r=verificationReceipt({...base,checks:[...pass('typecheck','unit','build','package'),{check_id:'e2e',status:'failed'}]});
 assert.equal(r.status,'failed');
 assert.equal(r.verification_level,'PACKAGE_VERIFIED');
});

test('the validator refuses self-promotion, dirty trees, synthetic evidence and unbacked manual qualification',()=>{
 const good=verificationReceipt({...base,checks:pass('typecheck','unit','build','package','e2e')});
 assert.throws(()=>validateVerificationReceipt({...good,verification_level:'GALAXY_QUALIFIED'}),/cross-app qualification/);
 assert.throws(()=>validateVerificationReceipt({...good,verification_level:'MANUAL_QUALIFIED'}),/manual-visual/);
 assert.throws(()=>validateVerificationReceipt({...good,galaxy_level:'V1G'}),/G0/);
 assert.throws(()=>validateVerificationReceipt({...good,revision:{...good.revision,dirty:true}}),/uncommitted/);
 assert.throws(()=>validateVerificationReceipt({...good,revision:{...good.revision,commit:'a9e2f4a'}}),/40-character/);
 assert.throws(()=>validateVerificationReceipt({...good,status:'passed',checks:[...good.checks.slice(0,-1),{check_id:'e2e',status:'failed',evidence_ref_ids:[]}]}),/failed check|support/);
 const synthetic=evidenceRefSchema.parse({schema_version:1,evidence_id:'x:1',kind:'screenshot',source_system:'manual',locator:{file:'a.png'},captured_at:'2026-10-05T10:00:00Z',visibility:'public',synthetic:true,review_state:'reviewed'});
 assert.throws(()=>verificationReceipt({...base,checks:pass('typecheck'),evidenceRefs:[synthetic]}),/synthetic evidence/);
 assert.throws(()=>verificationReceipt({...base,checks:[{check_id:'typecheck',status:'passed',evidence_ref_ids:['missing:1']}]}),/unknown evidence_ref_id/);
});

test('MANUAL_QUALIFIED needs a passed manual-visual check that cites its human review evidence',()=>{
 const review=evidenceRefSchema.parse({schema_version:1,evidence_id:'diagramcloud:manual-review:1',kind:'manual_observation',source_system:'manual',locator:{file:'release/manual-review.json'},captured_at:'2026-10-05T10:00:00Z',visibility:'public',synthetic:false,review_state:'reviewed'});
 const r=verificationReceipt({...base,checks:[...pass('typecheck','unit','build','package','e2e'),{check_id:'manual-visual',status:'passed',evidence_ref_ids:[review.evidence_id]}],evidenceRefs:[review]});
 assert.equal(r.verification_level,'MANUAL_QUALIFIED');
});
