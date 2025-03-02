# Captcha

Captcha App

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Introduction

A Node.js captcha service

## Features

- Allows captcha text 4 to 8 characters long.
- Provides a simple API to fetch an image and ID
- The server will keeps the image/ID pair in memory for a specified time (in config.js), then is removed.
- A simple front-end sample is provided in /public

## Installation

Step-by-step instructions on how to get the development environment running.

```bash
git clone https://github.com/yarrumevets/captcha.git
cd captcha
yarn
```

Node packages gm and express will be installed.

## Usage

```bash
node server.js
```

Go to `http://localhost:4191` in your browser.

Server response will be {isCorrect: true} if correct, or {isCorrect: false} if incorrect.

## License

Distributed under the MIT License. See the LICENSE file for more information.
