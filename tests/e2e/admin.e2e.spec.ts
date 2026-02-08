import { test, expect } from '@playwright/test'

test.describe('Auth', () => {
  test('login page is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })
})
