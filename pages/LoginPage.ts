import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.open('/login');
  }

  async signOn(username: string, password: string): Promise<void> {
    await this.page.getByLabel('Card number or username').fill(username);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByRole('button', { name: 'Sign On' }).click();
  }

  async expectErrorVisible(): Promise<void> {
    await expect(this.page.getByRole('alert')).toBeVisible();
  }

  async expectErrorText(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('alert')).toHaveText(text);
  }
}
