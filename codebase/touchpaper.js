/*
Copyright © 2014 Dmitry Radyno and Egor Bukrab

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

window.TouchPaperDetector = function(container, userOptions) {
    var options = (function() {
            var options = {
                    width: 320,
                    height: 240,
                    videoURL: false,
                    showVideo: false,
                    stableTime: 400,
                    touchSensitivity: 100
                },
                option;

            for (option in userOptions) {
                if (userOptions.hasOwnProperty(option)) {
                    options[option] = userOptions[option];
                }
            }
            return options;
        })(userOptions),

        video = (function() {
            var video = document.createElement("video");
            video.setAttribute("width", options.width.toString());
            video.setAttribute("height", options.height.toString());
            video.className = (!options.showVideo) ? "hidden" : "";
            video.setAttribute("loop", "");
            video.setAttribute("muted", "");
            container.appendChild(video);
            return video
        })(),
        playVideoWithTimeout = function() {
            setTimeout(function() {
                video.play();
            }, 500);
        },
        initVideo = function() {
            // initialize web camera or upload video
            video.addEventListener('loadeddata', startLoop);

            if (options.videoURL) {
                var source = document.createElement("source");
                source.setAttribute("src", options.videoURL);
                source.setAttribute("type", "video/mp4");
                video.appendChild(source);
                playVideoWithTimeout();
            } else {
                window.navigator.webkitGetUserMedia({video: true}, function(stream) {
                    try {
                        video.src = window.URL.createObjectURL(stream);
                    } catch (error) {
                        video.src = stream;
                    }
                    playVideoWithTimeout();
                }, function (error) {});
            }
        },

        ctx = (function() {
            var canvas = document.createElement("canvas");
            canvas.setAttribute("width", options.width.toString());
            canvas.setAttribute("height", options.height.toString());

            container.appendChild(canvas);
            return canvas.getContext("2d");
        })(),

        loopTimer = null,
        startLoop = function() {
            loopTimer = window.setInterval(nextFrame, 100);
        },
        stopLoop = function() {
            if (loopTimer) {
                window.clearInterval(loopTimer);
                loopTimer = null;
            }
        },
        buttons = [],
        readyToFind = false,
        startTime = null,
        nextFrame = function() {
            var imageData = captureFrame(),
                matrix = imageDataToMatrix(imageData),
                data = getContours(matrix, 80);
                //readyToFind = isReadyToFind(data, 0.1);

            if (readyToFind) {
                if (!startTime) {
                    startTime = (new Date()).valueOf();
                }
                buttons = findShapes(data, buttons);
                data = getContours(imageDataToMatrix(imageData), 120);
                buttons = findStableButtons(data, buttons);
                var timeDiff = ((new Date()).valueOf() - startTime);
                if (timeDiff > 5000) {
                    startTime = null;
                    readyToFind = false;
                }
            }
            data = getContours(imageDataToMatrix(imageData), 120);
            findTouches(data, buttons);

            imageData = dataToImageData(data);
            ctx.putImageData(imageData, 0, 0);
            drawButtons(buttons);
            drawReadyToFind(readyToFind);
        },

        findStableButtons = function(data, buttons) {
            var i, button,
                timestamp = (new Date()).valueOf();

            for (i = 0; i < buttons.length; i++) {
                button = buttons[i];
                if (!button.stable) {
                    /*if (!button.foundTime) {
                        button.foundTime = timestamp;
                    } else {
                        if (timestamp - button.foundTime > options.stableTime) {*/
                            button.stable = true;
                            button.isTouched = false;
                            button.hash = getButtonHash(data, button.coords);
                            fireEvent("buttonDetected", button);
                        //}
                    //}
                }
            }
            return buttons;
        },
        findTouches = function(data, buttons) {
            var i, button, newTouchStatus;
            for (i = 0; i < buttons.length; i++) {
                button = buttons[i];
                if (button.stable) {
                    newTouchStatus = isButtonTouched(data, button);
                    if (button.isTouched !== newTouchStatus) {
                        button.isTouched = newTouchStatus;
                        fireEvent(button.isTouched ? "touchstart" : "touchend", button);
                    }
                }
            }
        },
        isButtonTouched = function(data, button) {
            var buttonHash = getButtonHash(data, button.coords);
            //console.log(button.hash, buttonHash, buttonHash - button.hash);
            return buttonHash - button.hash > options.touchSensitivity;
        },
        getButtonHash = function(data, coords) {
            var sum = 0, row, col;
            for (row = coords[0][0]; row <= coords[1][0]; row++) {
                for (col = coords[0][1]; col <= coords[1][1]; col++) {
                    if (data[row]) {
                        sum += data[row][col] ? 1 : 0;
                    }
                }
            }
            return sum;
        },
        captureFrame = function() {
            ctx.drawImage(video, 0, 0, options.width, options.height);
            return ctx.getImageData(0, 0, options.width, options.height);
        },
        imageDataToMatrix = function(imageData) {
            var x, y, matrix = [], index, r, g, b, a;
            for (y = 0; y < options.height; y++) {
                matrix[y] = [];
                for (x = 0; x < options.width; x++) {
                    index = (y * options.width + x) * 4;
                    r = imageData.data[index] ? imageData.data[index] : 0;
                    g = imageData.data[index + 1] ? imageData.data[index + 1] : 0;
                    b = imageData.data[index + 2] ? imageData.data[index + 2] : 0;
                    a = imageData.data[index + 3] ? imageData.data[index + 3] : 0;
                    matrix[y][x] = Math.round((r + g + b) / 3);
                }
            }
            return matrix;
        },
        matrixToImageData = function(matrix) {
            var x, y, index,
                imageData = ctx.createImageData(options.width, options.height);
            for (y = 0; y < options.height; y++) {
                for (x = 0; x < options.width; x++) {
                    index = (y * options.width + x) * 4;
                    imageData.data[index] = matrix[y][x];
                    imageData.data[index + 1] = matrix[y][x];
                    imageData.data[index + 2] = matrix[y][x];
                    imageData.data[index + 3] = 255;
                }
            }
            return imageData;
        },
        dataToImageData = function(matrix) {
            var x, y, index,
                imageData = ctx.createImageData(options.width, options.height),
                color;
            for (y = 0; y < options.height; y++) {
                for (x = 0; x < options.width; x++) {
                    index = (y * options.width + x) * 4;
                    color = matrix[y][x] ? 0 : 255;
                    imageData.data[index] = color;
                    imageData.data[index + 1] = color;
                    imageData.data[index + 2] = color;
                    imageData.data[index + 3] = 255;
                }
            }
            return imageData;
        },
        isReadyToFind = function(matrix, blackLimit) {
            var x, y, sum = 0;
            for (y = 0; y < options.height; y++) {
                for (x = 0; x < options.width; x++) {
                    sum += matrix[y][x];
                }
            }
            return sum/(options.height*options.width) < blackLimit;
        },
        getContours = function(matrix, limit) {
            var x, y, isCloseToBorder = function(x, y) {
                var borderSize = 30;
                return (y < borderSize || y > options.height - borderSize || x < borderSize || x > options.width - borderSize);
            };
            for (y = 0; y < options.height; y++) {
                for (x = 0; x < options.width; x++) {
                    matrix[y][x] = (/*isCloseToBorder(x, y) || */matrix[y][x] > limit) ? 0 : 1;
                }
            }
            return matrix;
        },
        drawButtons = function(buttons) {
            var button;
            for (var i = 0; i < buttons.length; i++) {
                button = buttons[i];
                if (button.stable) {
                    ctx.beginPath();
                    ctx.lineWidth = "2";
                    ctx.strokeStyle = button.isTouched ? "green" : "red";
                    ctx.rect(button.coords[0][1], button.coords[0][0], button.coords[1][1] - button.coords[0][1], button.coords[1][0] - button.coords[0][0]);
                    ctx.stroke();
                }
            }
        },
        drawReadyToFind = function(isReadyToFind) {
            ctx.beginPath();
            ctx.lineWidth = "2";
            ctx.fillStyle = isReadyToFind ? "#00ff00" : "#ff0000";
            ctx.fillRect(4, 4, 20, 20);
            ctx.stroke();
        },
        findShapes = function(data, existingButtons) {
            var createTouchRect = function(shape){
                    var minX = Infinity;
                    var maxX = -1;
                    var minY = Infinity;
                    var maxY = -1;

                    for(var i = 0; i<shape.length; i++){
                        if(shape[i][0] < minX) {
                            minX = shape[i][0];
                        }
                        if(shape[i][0] > maxX) {
                            maxX = shape[i][0]
                        }
                        if(shape[i][1] < minY) {
                            minY = shape[i][1];
                        }
                        if(shape[i][1] > maxY){
                            maxY = shape[i][1];
                        }
                    }
                    return [[minX, minY], [maxX, maxY]];
                },
                findShape = function(data) {
                    var shape=[];
                    var image = data;


                    var boundaryPixel = findBoundaryPixel(image);
                    if (!boundaryPixel) {
                        return null;
                    }
                    var startX = boundaryPixel.white[0];
                    var startY = boundaryPixel.white[1];

                    var prevX = startX;
                    var prevY = startY;
                    var curX = boundaryPixel.black[0];
                    var curY = boundaryPixel.black[1];
                    var iterates = 0;

                    while (true){
                        if(image[curX] && image[curX][curY] === 1) {
                            shape.push([curX,curY]);
                            image[curX][curY]+=1;
                        }

                        var nexts = chooseNextStep(prevX,prevY,curX,curY,image[curX] ? image[curX][curY] || 0 : 0);
                        prevX = curX;
                        prevY = curY;
                        curX = nexts[0];
                        curY = nexts[1];

                        if(curX === startX && curY === startY){
                            break;
                        }
                        iterates++;
                        if (iterates > 5000) {
                            return null;
                        }
                    }
                    return createTouchRect(shape);
                },
                chooseNextStep = function(prevX, prevY, curX, curY, direction) {
                    var isX = curX - prevX;
                    var isY = curY - prevY;
                    var stepX;
                    var stepY;
                    if(direction > 0){
                        direction = 1;
                    }else{
                        direction = -1;
                    }

                    if(isX === 0 && isY === 1) {
                        stepX = -1*direction;
                        stepY = 0;
                    }
                    if(isX === 0 && isY === -1 ) {
                        stepX = 1*direction;
                        stepY = 0;
                    }
                    if(isX === 1 && isY === 0){
                        stepX = 0;
                        stepY = 1*direction;
                    }
                    if(isX === -1 && isY === 0){
                        stepX = 0;
                        stepY = -1*direction;
                    }

                    var nextX = curX + stepX;
                    var nextY = curY + stepY;
                    return [nextX,nextY];
                },
                findBoundaryPixel = function(image){
                    var prev, cur;
                    var prevX, prevY;
                    for(var i = 0; i < image.length; i++){
                        for(var j = 0; j< image[i].length; j++){
                            cur = image[i][j];
                            if(cur === 1 && prev === 0){
                                return {
                                    white:[prevX, prevY],
                                    black:[i,j]
                                }
                            }
                            prev = cur;
                            prevX = i;
                            prevY = j;
                        }
                    }
                },
                subtract = function(data, button) {
                    var x0 = Math.max(button[0][1] - 10, 0),
                        x1 = Math.min(button[1][1] + 10, data[0] ? data[0].length : 0),
                        y0 = Math.max(button[0][0] - 10, 0),
                        y1 = Math.min(button[1][0] + 10, data.length);

                    for (var row = y0; row <= y1; row++) {
                        for (var col = x0; col <= x1; col++) {
                            if (data[row]) {
                                data[row][col] = 0;
                            }
                        }
                    }
                    return data;
                },
                isFilled = function(data) {
                    var filled = 0,
                        height = data.length,
                        width = data[0] ? data[0].length : 0;
                    for (var i = 0; i < height; i++) {
                        for (var j = 0; j < width; j++) {
                            filled += data[i][j] ? 1 : 0;
                        }
                    }
                    return filled/(width*height) > 0.3;
                },
                isEmpty = function(data) {
                    for (var i = 0; i < data.length; i++) {
                        for (var j = 0; j < data[i].length; j++) {
                            if (data[i][j]) {
                                return false;
                            }
                        }
                    }
                    return true;
                },
                isButton = function(button) {
                    var minSize = 10;
                    return (button[1][0] - button[0][0] > minSize) && (button[1][1] - button[0][1] > minSize);
                },
                cropArea = function(data, coords) {
                    var cropedData = [],
                        extendSize = 0,
                        minX = Math.max(0, coords[0][1] - extendSize),
                        maxX = Math.min(options.width - 1, coords[1][1] + extendSize),
                        minY = Math.max(0, coords[0][0] - extendSize),
                        maxY = Math.min(options.width - 1, coords[1][0] + extendSize);

                    for (var row = minY, i = 0; row <= maxY; row++, i++) {
                        cropedData[i] = [];
                        for (var col = minX, j = 0; col <= maxX; col++, j++) {
                            if (data[row]) {
                                cropedData[i][j] = data[row][col] || 0;
                            }
                        }
                    }
                    return cropedData;
                },
                getButtonSquare = function(coords) {
                    return (coords[1][1] - coords[0][1]) * (coords[1][0] - coords[0][0]);
                },
                uuid = (function() {
                    var index = 1;
                    return function() {
                        return index++;
                    }
                })();
            var found = true,
                button = null,
                buttons = [];

            debugger;
            for (var i = 0; i < existingButtons.length; i++) {
                button = findShape(cropArea(data, existingButtons[i].coords));
                if (button) {
                    if (getButtonSquare(button) / getButtonSquare(existingButtons[i].coords) < 0.7) {
                        button = existingButtons[i].coords;
                    } else {
                        button[0][0] += existingButtons[i].coords[0][0];
                        button[0][1] += existingButtons[i].coords[0][1];
                        button[1][0] += existingButtons[i].coords[0][0];
                        button[1][1] += existingButtons[i].coords[0][1];
                    }
                    if (isButton(button)) {
                        existingButtons[i].coords = button;
                        buttons.push(existingButtons[i]);
                    }
                    data = subtract(data, button);
                }
            }
            while (!isEmpty(data) && !isFilled(data) && found && buttons.length < 8) {
                button = findShape(data);
                if (button) {
                    if (isButton(button)) {
                        buttons.push({
                            id: uuid(),
                            //sum: getButtonHash(data, button),
                            coords: button
                        });
                    }
                    data = subtract(data, button);
                } else {
                    found = false;
                }
            }
            return buttons;
        },
        events = {},
        fireEvent = function(eventName, data) {
            var handlers, i;
            eventName = eventName.toLowerCase();
            handlers = events[eventName];
            for (i = 0; i < handlers.length; i++) {
                handlers[i].call({}, data);
            }
        },
        attachEvent = function(eventName, handler) {
            eventName = eventName.toLowerCase();
            if (!events[eventName]) {
                events[eventName] = [];
            }
            events[eventName].push(handler);
        },
        clearButtons = function() {
            buttons = [];
            readyToFind = true;
        };

    initVideo();

    return {
        attachEvent: attachEvent,
        clear: clearButtons
    };
};