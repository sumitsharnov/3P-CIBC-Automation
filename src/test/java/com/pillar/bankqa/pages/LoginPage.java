package com.pillar.bankqa.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage extends BasePage {

    private static final By USERNAME_INPUT = By.id("username");
    private static final By PASSWORD_INPUT = By.id("password");
    private static final By SIGN_ON_BUTTON = By.xpath("//button[@type='submit']");
    private static final By ERROR_MESSAGE = By.cssSelector("[role='alert']");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public LoginPage navigateTo() {
        open("/login");
        return this;
    }

    public LoginPage navigateToBroken() {
        open("/login-broken");
        return this;
    }

    public void signOn(String username, String password) {
        type(USERNAME_INPUT, username);
        type(PASSWORD_INPUT, password);
        click(SIGN_ON_BUTTON);
    }

    public boolean isErrorMessageDisplayed() {
        return isVisible(ERROR_MESSAGE);
    }

    public String errorMessageText() {
        return textOf(ERROR_MESSAGE);
    }
}
