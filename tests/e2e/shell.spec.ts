import { test, expect } from '@playwright/test';

test('skip link exposes a single main and heading', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('scenario dialog contains keyboard focus, closes with Escape and restores trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Escolher cenário:/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Escolher cenário demonstrativo' });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  for (let i=0;i<12;i++) {
    await page.keyboard.press(i<6?'Tab':'Shift+Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});

test('simulation dialog closes with keyboard and restores focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Simular lançamento', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
