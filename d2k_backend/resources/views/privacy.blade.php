<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Direct2Kariakoo</title>
    <style>
        body {
            font-family: "Segoe UI", Arial, sans-serif;
            line-height: 1.7;
            margin: 0;
            padding: 0;
            background: #f9f9f9;
            color: #333;
        }
        header {
            background: #ffc107;
            color: #000;
            padding: 20px 40px;
            text-align: center;
        }
        header h1 {
            margin: 0;
            font-size: 28px;
        }
        .container {
            max-width: 900px;
            margin: 30px auto;
            padding: 25px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h2 {
            margin-top: 20px;
            color: #111;
        }
        footer {
            margin-top: 40px;
            text-align: center;
            font-size: 14px;
            color: #666;
            padding: 15px;
        }
    </style>
</head>
<body>
    <header>
        <h1>Privacy Policy</h1>
        <p>Effective Date: {{ date('F d, Y') }}</p>
    </header>

    <div class="container">
        <p>Direct2Kariakoo ("we", "our", or "us") operates the Direct2Kariakoo mobile application and website.</p>

        <h2>1. Information We Collect</h2>
        <ul>
            <li>Personal details (name, email, phone, address)</li>
            <li>Payment details (processed via third-party providers such as M-Pesa, Tigo Pesa, Airtel Money, Halopesa)</li>
            <li>Device information (IP address, device ID, app version)</li>
        </ul>

        <h2>2. How We Use Information</h2>
        <ul>
            <li>To process and deliver your orders</li>
            <li>To send order confirmations and updates</li>
            <li>To improve our app and customer experience</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We never sell your personal data. Information is only shared with trusted vendors, delivery partners, and payment providers to complete your orders.</p>

        <h2>4. Your Rights</h2>
        <p>You may request access, correction, or deletion of your personal data at any time by contacting us.</p>

        <h2>5. Contact Us</h2>
        <p>Email: <a href="mailto:support@direct2kariakoo.com">support@direct2kariakoo.com</a></p>
    </div>

    <footer>
        © {{ date('Y') }} Direct2Kariakoo. All rights reserved.
    </footer>
</body>
</html>
