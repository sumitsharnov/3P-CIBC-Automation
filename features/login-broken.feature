@login-broken
Feature: Broken Sign-On demo page (simulated defect)
  As a QA reviewer
  I want the /login-broken page to always fail sign-on
  So that the demo pipeline can showcase a test that correctly catches a real defect

  This is a deliberately separate feature from @login — /login-broken is a
  different page that simulates a persistent outage, even with correct
  credentials, and must not be conflated with the working /login flow.

  Background:
    Given I am on the broken sign-on demo page

  Scenario: Sign-on fails even with correct credentials
    When I attempt the broken sign-on with username "demo" and password "demo"
    Then I should see a service outage error
