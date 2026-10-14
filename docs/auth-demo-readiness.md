# Auth work for the demo

Reviewed main through 9816ab0. Login, sessions, CSRF and company role checks work. This school demo will run on one server.

This PR adds email verification, password recovery, team invitations, role changes and a company selector. It also covers candidate-directory approval, login limits and expired sessions. Existing accounts need to verify their email too.

Still to do:

- Finish Brevo sender setup and check email delivery against the hosted app.
- Account management and basic activity logs. Admin and department roles are placeholders.
- Check HTTPS, secure cookies and allowed origins when hosting.
- Stop tracking jobCrawler.env and exclude it from Docker builds. Rotate any live key in it.
