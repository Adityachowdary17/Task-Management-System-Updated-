import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

async function setup() {
  testEnv = await initializeTestEnvironment({
    projectId: 'cadence-security-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  });
}

async function runDirtyDozenTests() {
  await setup();

  const aliceCtx = testEnv.authenticatedContext('alice', { email: 'alice@example.com', email_verified: true });
  const unverifiedCtx = testEnv.authenticatedContext('alice', { email: 'alice@example.com', email_verified: false });
  const bobCtx = testEnv.authenticatedContext('bob', { email: 'bob@example.com', email_verified: true });
  const anonCtx = testEnv.unauthenticatedContext();

  const aliceDb = aliceCtx.firestore();
  const unverifiedDb = unverifiedCtx.firestore();
  const bobDb = bobCtx.firestore();
  const anonDb = anonCtx.firestore();

  // Seed valid project for Alice
  await assertSucceeds(
    setDoc(doc(aliceDb, 'users/alice/projects/mobile'), {
      id: 'mobile',
      ownerId: 'alice',
      name: 'Mobile app 2.0',
      color: '#0E6E62',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  );

  const validTask = {
    id: 'task-1',
    ownerId: 'alice',
    title: 'Ship tagging system',
    notes: 'Add category and tag filtering',
    project: 'mobile',
    category: 'feature',
    priority: 'high',
    status: 'progress',
    due: '2026-12-01',
    tags: ['ui', 'filters'],
    assignee: 'Alice',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // 1. Unauthenticated read/write fails
  await assertFails(getDoc(doc(anonDb, 'users/alice/tasks/task-1')));
  await assertFails(setDoc(doc(anonDb, 'users/alice/tasks/task-1'), validTask));

  // 2. Unverified email spoof fails
  await assertFails(setDoc(doc(unverifiedDb, 'users/alice/tasks/task-1'), validTask));

  // 3. Cross-user access fails
  await assertFails(setDoc(doc(bobDb, 'users/alice/tasks/task-1'), validTask));
  await assertFails(getDocs(query(collection(bobDb, 'users/alice/tasks'), where('ownerId', '==', 'alice'))));

  // 4. Cross-user PII leak fails
  await assertFails(getDoc(doc(bobDb, 'users/alice/private/profile')));

  // 5. Owner spoofing on create fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-spoof'), { ...validTask, id: 'task-spoof', ownerId: 'bob' }));

  // 6. Shadow field injection fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-shadow'), { ...validTask, id: 'task-shadow', isAdmin: true }));

  // 7. Orphaned project reference fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-orphan'), { ...validTask, id: 'task-orphan', project: 'does-not-exist' }));

  // 8. Invalid category or priority enum fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-bad-prio'), { ...validTask, id: 'task-bad-prio', priority: 'critical' }));
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-bad-cat'), { ...validTask, id: 'task-bad-cat', category: 'unknown' }));

  // 9. Array exhaustion (> 10 tags) fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-many-tags'), {
    ...validTask,
    id: 'task-many-tags',
    tags: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11']
  }));

  // 10. Array element type poisoning fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-bad-tag'), { ...validTask, id: 'task-bad-tag', tags: [12345] }));

  // 11. Client timestamp forgery fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/task-bad-time'), { ...validTask, id: 'task-bad-time', createdAt: new Date('2020-01-01') }));

  // 12. ID poisoning & immutable field mutation fails
  await assertFails(setDoc(doc(aliceDb, 'users/alice/tasks/bad$id!'), { ...validTask, id: 'bad$id!' }));
  await assertSucceeds(setDoc(doc(aliceDb, 'users/alice/tasks/task-1'), validTask));
  await assertFails(updateDoc(doc(aliceDb, 'users/alice/tasks/task-1'), { ownerId: 'bob', updatedAt: serverTimestamp() }));

  await testEnv.cleanup();
  console.log('All 12 Dirty Dozen security rules tests passed.');
}

runDirtyDozenTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
