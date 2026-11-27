<?php
/*
 * TEMPLATE ONLY.
 * Copy this file to config.php on your hosting account.
 * Fill in the values from InfinityFree's MySQL details.
 * Do not upload the real config.php to GitHub or share its password.
 */
return [
    'db_host' => 'YOUR_MYSQL_HOSTNAME',
    'db_name' => 'YOUR_DATABASE_NAME',
    'db_user' => 'YOUR_DATABASE_USERNAME',
    'db_pass' => 'YOUR_NEW_DATABASE_PASSWORD',
    'db_port' => 3306,\n    // Set the exact same long random value in GitHub Actions secret VEX_WORKER_TOKEN.\n    'worker_token' => 'REPLACE_WITH_A_LONG_RANDOM_SECRET',
];
