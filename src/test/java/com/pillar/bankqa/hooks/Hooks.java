package com.pillar.bankqa.hooks;

import com.pillar.bankqa.utils.DriverFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

/**
 * Driver lifecycle: one fresh browser per scenario. On failure, a screenshot
 * is embedded into the Cucumber JSON output so the report generator can pull
 * it back out per failing step.
 */
public class Hooks {

    @Before
    public void beforeScenario(Scenario scenario) {
        DriverFactory.getDriver();
    }

    @After
    public void afterScenario(Scenario scenario) {
        WebDriver driver = DriverFactory.getDriver();
        if (scenario.isFailed()) {
            byte[] screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(screenshot, "image/png", scenario.getName());
        }
        DriverFactory.quitDriver();
    }
}
