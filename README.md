# IESViewer360
View IES photometric light in 2d and 3d

[English](README.md) | [中文](README.zh-CN.md)

## Project Introduction
This is a web-based project built with three.js / SVG for viewing IES files and displaying their optical effects.

### Problems Solved by This Project
IES files are mathematical models used to describe light sources, including information about shape, brightness, color, direction, distance, angles, and more. However, traditional IES viewing tools display polar coordinate light intensity distributions in 2D planes, requiring users to control angles to switch and observe light intensity distributions in 3D space. This approach is not intuitive or convenient for non-professional users. This project addresses the need for viewing IES files in 3D space, examining data, and exporting data.

This project features two independent page displays: parser and simulator.

### IES Parser
This page is designed for displaying IES files on mobile devices. Click the image to watch the video:

[![IES Parser](docs/ies_parser.png)](docs/ies_parser_1.mp4)

### IES Simulator

This page is designed for simulating and analyzing room lighting using IES files on PCs. Click the image to watch the video:

[![IES Simulator](docs/ies_simulator.png)](docs/ies_simulator_1.mp4)

## Project Background

This project was initially developed as a DEMO for OPPLE Lighting (OPPO) in early 2024. OPPO is a Chinese lighting solutions provider. When developing lighting products, they needed to use Dialux software to obtain and analyze IES lighting data. However, Dialux software is complex for non-professional users, so OPPO wanted a simple and easy-to-use tool for visual lumen analysis of IES files and generating room lighting data.

DIALUX Solution:
![Dialux snapshot](docs/dialux.png)

The core functionalities of this project include two main aspects:
- IES file parsing and data extraction
- Calculation of IES lumen data at any point in 3D space

IES files are text files following the IEEE 754 standard format, which is publicly available. The parsing logic performs text parsing and data conversion based on its documentation. Currently, the best IES viewer is available at: *http://photometricviewer.com/*

Another important reference is the Vray IES light in 3ds Max. The following images show Vray simulations in Max:

![max workspace](docs/max-workplane.png)

![max colors](docs/max-colors.png)

To calculate correct illuminance at spatial points, the calculation work involved creating an illuminance model in Max for specific IES files, obtaining data, and comparing it with JavaScript calculation results. During the calculation process, some issues were encountered, and I emailed the author of photometricviewer for guidance. Many thanks to Andrey L for his response:

```text
Questions:

1. How to get the default lm value for an IES file: 
2. How to calculate the ies light meters values in lx , for a special point , like in 3dsmax and vraylightMeter object:i want to get the max value of the lx value in the ground: 
 

From: Andrey L <iesviewer@gmail.com> 
Sent: March 19, 2024 17:10 
To: chang yunhai <changyunhai@hotmail.com> 
Subject: Re: ies questions, thanks 

Dear Chang, 

1) lumen (lm) is the integral of intensity (cd) over angles. Photometric file is a data set of intensity distributions at angles, so you need to integrate carefully using numerical methods and everything will work out; 

2) lux = n * Iv / (r*r), where Iv - intensity, r - distance, n - slope factor, if the beam falls vertically, then it is equal to 1. In general, if we take the reference angle (a) from the normal, then it will be n = cos (a). Calc lux over the entire surface to find the maximum. 

Regards, 

Andrey 
 
```

## Project Evaluation and Experience

The main technologies and knowledge used in this project:
- Computer Science: Graphics, Web3D display technology
- Mathematics: Spherical coordinate system, spherical integration
- Physics: Photometry, radiometry

Extensive research and references were consulted during development. Long periods of debugging and boundary detection calculations were performed.

### Project Outcome

After creating the demo for OPPO, the project did not continue further due to various reasons. However, the project itself can serve as a reference.

## Try It Out

This project is a purely static web project that can be opened directly in a browser without installing any software.

- IES Parser: *https://changyunhai.github.io/IESViewer360/build-parser/index.html*

- IES Simulator: *https://changyunhai.github.io/IESViewer360/build-simulator/index.html*
