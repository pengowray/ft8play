// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
export class RadioError extends Error {
    constructor(message, typeOrOptions, options) {
        super(message, options !== undefined
            ? options
            : typeof typeOrOptions === "object"
                ? typeOrOptions
                : undefined);
        if (typeof typeOrOptions === "number") {
            this.type = typeOrOptions;
            this.name = `RadioError.${RadioErrorType[typeOrOptions]}`;
        }
    }
    type;
}
export var RadioErrorType;
(function (RadioErrorType) {
    RadioErrorType[RadioErrorType["NoUsbSupport"] = 0] = "NoUsbSupport";
    RadioErrorType[RadioErrorType["NoDeviceSelected"] = 1] = "NoDeviceSelected";
    RadioErrorType[RadioErrorType["UnsupportedDevice"] = 2] = "UnsupportedDevice";
    RadioErrorType[RadioErrorType["UsbTransferError"] = 3] = "UsbTransferError";
    RadioErrorType[RadioErrorType["TunerError"] = 4] = "TunerError";
})(RadioErrorType || (RadioErrorType = {}));
