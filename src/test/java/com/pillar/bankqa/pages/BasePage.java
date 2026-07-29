package com.pillar.bankqa.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

import com.pillar.bankqa.utils.ConfigReader;

/**
 * Shared wait/interaction primitives. Page Objects extend this and expose
 * intent-named methods (e.g. signIn(user, pass)) — no raw Selenium calls
 * belong in step definitions.
 */
public abstract class BasePage {

    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver,
                Duration.ofSeconds(ConfigReader.getInt("explicitWaitSeconds", 10)));
    }

    protected WebElement waitVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected WebElement waitClickable(By locator) {
        return wait.until(ExpectedConditions.elementToBeClickable(locator));
    }

    protected void type(By locator, String text) {
        WebElement element = waitVisible(locator);
        element.clear();
        element.sendKeys(text);
    }

    protected void click(By locator) {
        waitClickable(locator).click();
    }

    protected boolean isVisible(By locator) {
        try {
            return waitVisible(locator).isDisplayed();
        } catch (Exception e) {
            return false;
        }
    }

    protected String textOf(By locator) {
        return waitVisible(locator).getText();
    }

    public void open(String relativePath) {
        String baseUrl = ConfigReader.get("baseUrl", "http://localhost:5173");
        driver.get(baseUrl + relativePath);
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }
}
