async function navigate(page, view) {
  const target = page.locator('[data-v="' + view + '"]');
  if (!await target.isVisible() && await page.locator('#navMore').isVisible()) {
    await page.locator('#navMore').click();
  }
  await target.click();
}

module.exports = { navigate };
