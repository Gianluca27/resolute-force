import { sectionSchema } from '@resolute/shared';
import { ADDABLE_TYPES, newSection, BLOCK_LABELS, blockSummary } from './blockDefs';

it('every addable type has a factory whose output passes the schema', () => {
  for (const type of ADDABLE_TYPES) {
    const s = newSection(type);
    const parsed = sectionSchema.safeParse(s);
    expect(parsed.success, `${type}: ${JSON.stringify(parsed.success ? '' : parsed.error.issues)}`).toBe(true);
    expect(BLOCK_LABELS[type]).toBeTruthy();
  }
});

it('the new blocks are addable and summarized', () => {
  expect(ADDABLE_TYPES).toContain('sizeTable');
  expect(ADDABLE_TYPES).toContain('testimonials');
  expect(ADDABLE_TYPES).toContain('videoEmbed');
  expect(blockSummary(newSection('sizeTable'))).toBeTruthy();
});
