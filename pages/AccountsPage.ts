import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AccountsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.page).toHaveURL(/\/accounts/);
  }
}
