# Auth work for the demo

Reviewed main through 9816ab0. Login, sessions, CSRF and company role checks work. This school demo will run on one server.

This PR covers approved-company access to the candidate directory, the login-limit bypass and expired-session handling.

Still to do:

- Email verification and password recovery.
- Company invitations, role changes, ownership transfer and a company selector.
- Account management and basic activity logs. Admin and department roles are placeholders.
- Check HTTPS, secure cookies and allowed origins when hosting.
- Add more role and browser tests.
- Stop tracking jobCrawler.env and exclude it from Docker builds. Rotate any live key in it.
