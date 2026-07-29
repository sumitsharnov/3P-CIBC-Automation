import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The simulated-outage demo page: sign-on fails even with correct
 * credentials. Deliberately a separate Page Object from LoginPage — its
 * feature/tests must not be conflated with the working /login flow.
 */
export class LoginBrokenPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.open('/login-broken');
  }

  async signOn(username: string, password: string): Promise<void> {
    await this.page.getByLabel('Card number or username').fill(username);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByRole('button', { name: 'Sign On' }).click();
  }

  async expectServiceOutageError(): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText('503');
  }
}
