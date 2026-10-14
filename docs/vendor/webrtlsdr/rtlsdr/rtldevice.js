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
/** Direct sampling modes. */
export var DirectSampling;
(function (DirectSampling) {
    /** No direct sampling. */
    DirectSampling[DirectSampling["Off"] = 0] = "Off";
    /** I channel. */
    DirectSampling[DirectSampling["I"] = 1] = "I";
    /** Q channel. */
    DirectSampling[DirectSampling["Q"] = 2] = "Q";
})(DirectSampling || (DirectSampling = {}));
