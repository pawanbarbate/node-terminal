import React from 'react';
import { renderToString } from 'ink';
import SetupWizard from '../src/components/wizard/SetupWizard.js';

console.log('--- TEST 1: Render 80x24 SetupWizard ---');
const output80x24 = renderToString(
  <SetupWizard 
    width={80} 
    height={24} 
    onComplete={() => {}} 
  />
);

const lines80x24 = output80x24.split('\n');
console.log(`Total lines rendered: ${lines80x24.length}`);

console.log('\n--- TEST 2: Render 120x36 SetupWizard ---');
const output120x36 = renderToString(
  <SetupWizard 
    width={120} 
    height={36} 
    onComplete={() => {}} 
  />
);

const lines120x36 = output120x36.split('\n');
console.log(`Total lines rendered: ${lines120x36.length}`);

// Verify presence of signature elements
const hasBranding = output80x24.includes('DevPulse');
const hasRegistry = output80x24.includes('REGISTRY');
const hasForm = output80x24.includes('EDIT') || output80x24.includes('NEW SERVICE');
const hasAddBtn = output80x24.includes('+ Add');
const hasRemoveBtn = output80x24.includes('Remove');
const hasSaveCTA = output80x24.includes('Save & Launch');
const hasFooter = output80x24.includes('Setup');
const hasFormSections = ['IDENTITY', 'STARTUP', 'ORCHESTRATION'].every(section => output80x24.includes(section));
const hasCoreFields = ['Name:', 'Folder:', 'Command:', 'Port:', 'Boot:', 'Depends:', 'Pre-cmd:']
  .every(field => output80x24.includes(field));
const hasSectionOrder = output80x24.indexOf('IDENTITY') < output80x24.indexOf('Name:') &&
  output80x24.indexOf('STARTUP') < output80x24.indexOf('Command:') &&
  output80x24.indexOf('ORCHESTRATION') < output80x24.indexOf('Depends:');

console.log('\n--- VERIFICATION CHECKS ---');
console.log('Header branding present:', hasBranding);
console.log('Service registry present:', hasRegistry);
console.log('Service form present:', hasForm);
console.log('+ Add Service button present:', hasAddBtn);
console.log('Remove button present:', hasRemoveBtn);
console.log('Save & Launch CTA present:', hasSaveCTA);
console.log('Footer present:', hasFooter);
console.log('Sectioned form present:', hasFormSections);
console.log('All existing form fields present:', hasCoreFields);
console.log('Fields grouped under the correct sections:', hasSectionOrder);

if (hasBranding && hasRegistry && hasForm && hasAddBtn && hasRemoveBtn && hasSaveCTA && hasFooter &&
  hasFormSections && hasCoreFields && hasSectionOrder && lines80x24.length === 24 && lines120x36.length === 36) {
  console.log('\n✅ ALL VISUAL SYNERGY AND RESPONSIVE LAYOUT CHECKS PASSED!');
} else {
  console.error('\n❌ SOME CHECKS FAILED!');
  process.exit(1);
}
