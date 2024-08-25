
// Free text character table
const FT8_CHAR_TABLE_FULL = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?";

// Costas array for sync
const COSTAS_ARRAY = [3, 1, 4, 0, 6, 5, 2];
const COSTAS_STR = '3140652';

const FTX_PAYLOAD_LENGTH_BYTES = 10;
const FT8_NN = 79; // Total channel symbols

const MAXGRID4 = 32400;

// Parity generator matrix for (174,91) LDPC code, stored in bitpacked format (MSB first)
// const uint8_t kFTX_LDPC_generator[FTX_LDPC_M][FTX_LDPC_K_BYTES] = [
kFTX_LDPC_generator = [
    [ 0x83, 0x29, 0xce, 0x11, 0xbf, 0x31, 0xea, 0xf5, 0x09, 0xf2, 0x7f, 0xc0 ],
    [ 0x76, 0x1c, 0x26, 0x4e, 0x25, 0xc2, 0x59, 0x33, 0x54, 0x93, 0x13, 0x20 ],
    [ 0xdc, 0x26, 0x59, 0x02, 0xfb, 0x27, 0x7c, 0x64, 0x10, 0xa1, 0xbd, 0xc0 ],
    [ 0x1b, 0x3f, 0x41, 0x78, 0x58, 0xcd, 0x2d, 0xd3, 0x3e, 0xc7, 0xf6, 0x20 ],
    [ 0x09, 0xfd, 0xa4, 0xfe, 0xe0, 0x41, 0x95, 0xfd, 0x03, 0x47, 0x83, 0xa0 ],
    [ 0x07, 0x7c, 0xcc, 0xc1, 0x1b, 0x88, 0x73, 0xed, 0x5c, 0x3d, 0x48, 0xa0 ],
    [ 0x29, 0xb6, 0x2a, 0xfe, 0x3c, 0xa0, 0x36, 0xf4, 0xfe, 0x1a, 0x9d, 0xa0 ],
    [ 0x60, 0x54, 0xfa, 0xf5, 0xf3, 0x5d, 0x96, 0xd3, 0xb0, 0xc8, 0xc3, 0xe0 ],
    [ 0xe2, 0x07, 0x98, 0xe4, 0x31, 0x0e, 0xed, 0x27, 0x88, 0x4a, 0xe9, 0x00 ],
    [ 0x77, 0x5c, 0x9c, 0x08, 0xe8, 0x0e, 0x26, 0xdd, 0xae, 0x56, 0x31, 0x80 ],
    [ 0xb0, 0xb8, 0x11, 0x02, 0x8c, 0x2b, 0xf9, 0x97, 0x21, 0x34, 0x87, 0xc0 ],
    [ 0x18, 0xa0, 0xc9, 0x23, 0x1f, 0xc6, 0x0a, 0xdf, 0x5c, 0x5e, 0xa3, 0x20 ],
    [ 0x76, 0x47, 0x1e, 0x83, 0x02, 0xa0, 0x72, 0x1e, 0x01, 0xb1, 0x2b, 0x80 ],
    [ 0xff, 0xbc, 0xcb, 0x80, 0xca, 0x83, 0x41, 0xfa, 0xfb, 0x47, 0xb2, 0xe0 ],
    [ 0x66, 0xa7, 0x2a, 0x15, 0x8f, 0x93, 0x25, 0xa2, 0xbf, 0x67, 0x17, 0x00 ],
    [ 0xc4, 0x24, 0x36, 0x89, 0xfe, 0x85, 0xb1, 0xc5, 0x13, 0x63, 0xa1, 0x80 ],
    [ 0x0d, 0xff, 0x73, 0x94, 0x14, 0xd1, 0xa1, 0xb3, 0x4b, 0x1c, 0x27, 0x00 ],
    [ 0x15, 0xb4, 0x88, 0x30, 0x63, 0x6c, 0x8b, 0x99, 0x89, 0x49, 0x72, 0xe0 ],
    [ 0x29, 0xa8, 0x9c, 0x0d, 0x3d, 0xe8, 0x1d, 0x66, 0x54, 0x89, 0xb0, 0xe0 ],
    [ 0x4f, 0x12, 0x6f, 0x37, 0xfa, 0x51, 0xcb, 0xe6, 0x1b, 0xd6, 0xb9, 0x40 ],
    [ 0x99, 0xc4, 0x72, 0x39, 0xd0, 0xd9, 0x7d, 0x3c, 0x84, 0xe0, 0x94, 0x00 ],
    [ 0x19, 0x19, 0xb7, 0x51, 0x19, 0x76, 0x56, 0x21, 0xbb, 0x4f, 0x1e, 0x80 ],
    [ 0x09, 0xdb, 0x12, 0xd7, 0x31, 0xfa, 0xee, 0x0b, 0x86, 0xdf, 0x6b, 0x80 ],
    [ 0x48, 0x8f, 0xc3, 0x3d, 0xf4, 0x3f, 0xbd, 0xee, 0xa4, 0xea, 0xfb, 0x40 ],
    [ 0x82, 0x74, 0x23, 0xee, 0x40, 0xb6, 0x75, 0xf7, 0x56, 0xeb, 0x5f, 0xe0 ],
    [ 0xab, 0xe1, 0x97, 0xc4, 0x84, 0xcb, 0x74, 0x75, 0x71, 0x44, 0xa9, 0xa0 ],
    [ 0x2b, 0x50, 0x0e, 0x4b, 0xc0, 0xec, 0x5a, 0x6d, 0x2b, 0xdb, 0xdd, 0x00 ],
    [ 0xc4, 0x74, 0xaa, 0x53, 0xd7, 0x02, 0x18, 0x76, 0x16, 0x69, 0x36, 0x00 ],
    [ 0x8e, 0xba, 0x1a, 0x13, 0xdb, 0x33, 0x90, 0xbd, 0x67, 0x18, 0xce, 0xc0 ],
    [ 0x75, 0x38, 0x44, 0x67, 0x3a, 0x27, 0x78, 0x2c, 0xc4, 0x20, 0x12, 0xe0 ],
    [ 0x06, 0xff, 0x83, 0xa1, 0x45, 0xc3, 0x70, 0x35, 0xa5, 0xc1, 0x26, 0x80 ],
    [ 0x3b, 0x37, 0x41, 0x78, 0x58, 0xcc, 0x2d, 0xd3, 0x3e, 0xc3, 0xf6, 0x20 ],
    [ 0x9a, 0x4a, 0x5a, 0x28, 0xee, 0x17, 0xca, 0x9c, 0x32, 0x48, 0x42, 0xc0 ],
    [ 0xbc, 0x29, 0xf4, 0x65, 0x30, 0x9c, 0x97, 0x7e, 0x89, 0x61, 0x0a, 0x40 ],
    [ 0x26, 0x63, 0xae, 0x6d, 0xdf, 0x8b, 0x5c, 0xe2, 0xbb, 0x29, 0x48, 0x80 ],
    [ 0x46, 0xf2, 0x31, 0xef, 0xe4, 0x57, 0x03, 0x4c, 0x18, 0x14, 0x41, 0x80 ],
    [ 0x3f, 0xb2, 0xce, 0x85, 0xab, 0xe9, 0xb0, 0xc7, 0x2e, 0x06, 0xfb, 0xe0 ],
    [ 0xde, 0x87, 0x48, 0x1f, 0x28, 0x2c, 0x15, 0x39, 0x71, 0xa0, 0xa2, 0xe0 ],
    [ 0xfc, 0xd7, 0xcc, 0xf2, 0x3c, 0x69, 0xfa, 0x99, 0xbb, 0xa1, 0x41, 0x20 ],
    [ 0xf0, 0x26, 0x14, 0x47, 0xe9, 0x49, 0x0c, 0xa8, 0xe4, 0x74, 0xce, 0xc0 ],
    [ 0x44, 0x10, 0x11, 0x58, 0x18, 0x19, 0x6f, 0x95, 0xcd, 0xd7, 0x01, 0x20 ],
    [ 0x08, 0x8f, 0xc3, 0x1d, 0xf4, 0xbf, 0xbd, 0xe2, 0xa4, 0xea, 0xfb, 0x40 ],
    [ 0xb8, 0xfe, 0xf1, 0xb6, 0x30, 0x77, 0x29, 0xfb, 0x0a, 0x07, 0x8c, 0x00 ],
    [ 0x5a, 0xfe, 0xa7, 0xac, 0xcc, 0xb7, 0x7b, 0xbc, 0x9d, 0x99, 0xa9, 0x00 ],
    [ 0x49, 0xa7, 0x01, 0x6a, 0xc6, 0x53, 0xf6, 0x5e, 0xcd, 0xc9, 0x07, 0x60 ],
    [ 0x19, 0x44, 0xd0, 0x85, 0xbe, 0x4e, 0x7d, 0xa8, 0xd6, 0xcc, 0x7d, 0x00 ],
    [ 0x25, 0x1f, 0x62, 0xad, 0xc4, 0x03, 0x2f, 0x0e, 0xe7, 0x14, 0x00, 0x20 ],
    [ 0x56, 0x47, 0x1f, 0x87, 0x02, 0xa0, 0x72, 0x1e, 0x00, 0xb1, 0x2b, 0x80 ],
    [ 0x2b, 0x8e, 0x49, 0x23, 0xf2, 0xdd, 0x51, 0xe2, 0xd5, 0x37, 0xfa, 0x00 ],
    [ 0x6b, 0x55, 0x0a, 0x40, 0xa6, 0x6f, 0x47, 0x55, 0xde, 0x95, 0xc2, 0x60 ],
    [ 0xa1, 0x8a, 0xd2, 0x8d, 0x4e, 0x27, 0xfe, 0x92, 0xa4, 0xf6, 0xc8, 0x40 ],
    [ 0x10, 0xc2, 0xe5, 0x86, 0x38, 0x8c, 0xb8, 0x2a, 0x3d, 0x80, 0x75, 0x80 ],
    [ 0xef, 0x34, 0xa4, 0x18, 0x17, 0xee, 0x02, 0x13, 0x3d, 0xb2, 0xeb, 0x00 ],
    [ 0x7e, 0x9c, 0x0c, 0x54, 0x32, 0x5a, 0x9c, 0x15, 0x83, 0x6e, 0x00, 0x00 ],
    [ 0x36, 0x93, 0xe5, 0x72, 0xd1, 0xfd, 0xe4, 0xcd, 0xf0, 0x79, 0xe8, 0x60 ],
    [ 0xbf, 0xb2, 0xce, 0xc5, 0xab, 0xe1, 0xb0, 0xc7, 0x2e, 0x07, 0xfb, 0xe0 ],
    [ 0x7e, 0xe1, 0x82, 0x30, 0xc5, 0x83, 0xcc, 0xcc, 0x57, 0xd4, 0xb0, 0x80 ],
    [ 0xa0, 0x66, 0xcb, 0x2f, 0xed, 0xaf, 0xc9, 0xf5, 0x26, 0x64, 0x12, 0x60 ],
    [ 0xbb, 0x23, 0x72, 0x5a, 0xbc, 0x47, 0xcc, 0x5f, 0x4c, 0xc4, 0xcd, 0x20 ],
    [ 0xde, 0xd9, 0xdb, 0xa3, 0xbe, 0xe4, 0x0c, 0x59, 0xb5, 0x60, 0x9b, 0x40 ],
    [ 0xd9, 0xa7, 0x01, 0x6a, 0xc6, 0x53, 0xe6, 0xde, 0xcd, 0xc9, 0x03, 0x60 ],
    [ 0x9a, 0xd4, 0x6a, 0xed, 0x5f, 0x70, 0x7f, 0x28, 0x0a, 0xb5, 0xfc, 0x40 ],
    [ 0xe5, 0x92, 0x1c, 0x77, 0x82, 0x25, 0x87, 0x31, 0x6d, 0x7d, 0x3c, 0x20 ],
    [ 0x4f, 0x14, 0xda, 0x82, 0x42, 0xa8, 0xb8, 0x6d, 0xca, 0x73, 0x35, 0x20 ],
    [ 0x8b, 0x8b, 0x50, 0x7a, 0xd4, 0x67, 0xd4, 0x44, 0x1d, 0xf7, 0x70, 0xe0 ],
    [ 0x22, 0x83, 0x1c, 0x9c, 0xf1, 0x16, 0x94, 0x67, 0xad, 0x04, 0xb6, 0x80 ],
    [ 0x21, 0x3b, 0x83, 0x8f, 0xe2, 0xae, 0x54, 0xc3, 0x8e, 0xe7, 0x18, 0x00 ],
    [ 0x5d, 0x92, 0x6b, 0x6d, 0xd7, 0x1f, 0x08, 0x51, 0x81, 0xa4, 0xe1, 0x20 ],
    [ 0x66, 0xab, 0x79, 0xd4, 0xb2, 0x9e, 0xe6, 0xe6, 0x95, 0x09, 0xe5, 0x60 ],
    [ 0x95, 0x81, 0x48, 0x68, 0x2d, 0x74, 0x8a, 0x38, 0xdd, 0x68, 0xba, 0xa0 ],
    [ 0xb8, 0xce, 0x02, 0x0c, 0xf0, 0x69, 0xc3, 0x2a, 0x72, 0x3a, 0xb1, 0x40 ],
    [ 0xf4, 0x33, 0x1d, 0x6d, 0x46, 0x16, 0x07, 0xe9, 0x57, 0x52, 0x74, 0x60 ],
    [ 0x6d, 0xa2, 0x3b, 0xa4, 0x24, 0xb9, 0x59, 0x61, 0x33, 0xcf, 0x9c, 0x80 ],
    [ 0xa6, 0x36, 0xbc, 0xbc, 0x7b, 0x30, 0xc5, 0xfb, 0xea, 0xe6, 0x7f, 0xe0 ],
    [ 0x5c, 0xb0, 0xd8, 0x6a, 0x07, 0xdf, 0x65, 0x4a, 0x90, 0x89, 0xa2, 0x00 ],
    [ 0xf1, 0x1f, 0x10, 0x68, 0x48, 0x78, 0x0f, 0xc9, 0xec, 0xdd, 0x80, 0xa0 ],
    [ 0x1f, 0xbb, 0x53, 0x64, 0xfb, 0x8d, 0x2c, 0x9d, 0x73, 0x0d, 0x5b, 0xa0 ],
    [ 0xfc, 0xb8, 0x6b, 0xc7, 0x0a, 0x50, 0xc9, 0xd0, 0x2a, 0x5d, 0x03, 0x40 ],
    [ 0xa5, 0x34, 0x43, 0x30, 0x29, 0xea, 0xc1, 0x5f, 0x32, 0x2e, 0x34, 0xc0 ],
    [ 0xc9, 0x89, 0xd9, 0xc7, 0xc3, 0xd3, 0xb8, 0xc5, 0x5d, 0x75, 0x13, 0x00 ],
    [ 0x7b, 0xb3, 0x8b, 0x2f, 0x01, 0x86, 0xd4, 0x66, 0x43, 0xae, 0x96, 0x20 ],
    [ 0x26, 0x44, 0xeb, 0xad, 0xeb, 0x44, 0xb9, 0x46, 0x7d, 0x1f, 0x42, 0xc0 ],
    [ 0x60, 0x8c, 0xc8, 0x57, 0x59, 0x4b, 0xfb, 0xb5, 0x5d, 0x69, 0x60, 0x00 ]
];

// Parity check matrix (kFTX_LDPC_Nm)
const LDPC_MATRIX = [
    [ 4, 31, 59, 91, 92, 96, 153 ],
    [ 5, 32, 60, 93, 115, 146, 0 ],
    [ 6, 24, 61, 94, 122, 151, 0 ],
    [ 7, 33, 62, 95, 96, 143, 0 ],
    [ 8, 25, 63, 83, 93, 96, 148 ],
    [ 6, 32, 64, 97, 126, 138, 0 ],
    [ 5, 34, 65, 78, 98, 107, 154 ],
    [ 9, 35, 66, 99, 139, 146, 0 ],
    [ 10, 36, 67, 100, 107, 126, 0 ],
    [ 11, 37, 67, 87, 101, 139, 158 ],
    [ 12, 38, 68, 102, 105, 155, 0 ],
    [ 13, 39, 69, 103, 149, 162, 0 ],
    [ 8, 40, 70, 82, 104, 114, 145 ],
    [ 14, 41, 71, 88, 102, 123, 156 ],
    [ 15, 42, 59, 106, 123, 159, 0 ],
    [ 1, 33, 72, 106, 107, 157, 0 ],
    [ 16, 43, 73, 108, 141, 160, 0 ],
    [ 17, 37, 74, 81, 109, 131, 154 ],
    [ 11, 44, 75, 110, 121, 166, 0 ],
    [ 45, 55, 64, 111, 130, 161, 173 ],
    [ 8, 46, 71, 112, 119, 166, 0 ],
    [ 18, 36, 76, 89, 113, 114, 143 ],
    [ 19, 38, 77, 104, 116, 163, 0 ],
    [ 20, 47, 70, 92, 138, 165, 0 ],
    [ 2, 48, 74, 113, 128, 160, 0 ],
    [ 21, 45, 78, 83, 117, 121, 151 ],
    [ 22, 47, 58, 118, 127, 164, 0 ],
    [ 16, 39, 62, 112, 134, 158, 0 ],
    [ 23, 43, 79, 120, 131, 145, 0 ],
    [ 19, 35, 59, 73, 110, 125, 161 ],
    [ 20, 36, 63, 94, 136, 161, 0 ],
    [ 14, 31, 79, 98, 132, 164, 0 ],
    [ 3, 44, 80, 124, 127, 169, 0 ],
    [ 19, 46, 81, 117, 135, 167, 0 ],
    [ 7, 49, 58, 90, 100, 105, 168 ],
    [ 12, 50, 61, 118, 119, 144, 0 ],
    [ 13, 51, 64, 114, 118, 157, 0 ],
    [ 24, 52, 76, 129, 148, 149, 0 ],
    [ 25, 53, 69, 90, 101, 130, 156 ],
    [ 20, 46, 65, 80, 120, 140, 170 ],
    [ 21, 54, 77, 100, 140, 171, 0 ],
    [ 35, 82, 133, 142, 171, 174, 0 ],
    [ 14, 30, 83, 113, 125, 170, 0 ],
    [ 4, 29, 68, 120, 134, 173, 0 ],
    [ 1, 4, 52, 57, 86, 136, 152 ],
    [ 26, 51, 56, 91, 122, 137, 168 ],
    [ 52, 84, 110, 115, 145, 168, 0 ],
    [ 7, 50, 81, 99, 132, 173, 0 ],
    [ 23, 55, 67, 95, 172, 174, 0 ],
    [ 26, 41, 77, 109, 141, 148, 0 ],
    [ 2, 27, 41, 61, 62, 115, 133 ],
    [ 27, 40, 56, 124, 125, 126, 0 ],
    [ 18, 49, 55, 124, 141, 167, 0 ],
    [ 6, 33, 85, 108, 116, 156, 0 ],
    [ 28, 48, 70, 85, 105, 129, 158 ],
    [ 9, 54, 63, 131, 147, 155, 0 ],
    [ 22, 53, 68, 109, 121, 174, 0 ],
    [ 3, 13, 48, 78, 95, 123, 0 ],
    [ 31, 69, 133, 150, 155, 169, 0 ],
    [ 12, 43, 66, 89, 97, 135, 159 ],
    [ 5, 39, 75, 102, 136, 167, 0 ],
    [ 2, 54, 86, 101, 135, 164, 0 ],
    [ 15, 56, 87, 108, 119, 171, 0 ],
    [ 10, 44, 82, 91, 111, 144, 149 ],
    [ 23, 34, 71, 94, 127, 153, 0 ],
    [ 11, 49, 88, 92, 142, 157, 0 ],
    [ 29, 34, 87, 97, 147, 162, 0 ],
    [ 30, 50, 60, 86, 137, 142, 162 ],
    [ 10, 53, 66, 84, 112, 128, 165 ],
    [ 22, 57, 85, 93, 140, 159, 0 ],
    [ 28, 32, 72, 103, 132, 166, 0 ],
    [ 28, 29, 84, 88, 117, 143, 150 ],
    [ 1, 26, 45, 80, 128, 147, 0 ],
    [ 17, 27, 89, 103, 116, 153, 0 ],
    [ 51, 57, 98, 163, 165, 172, 0 ],
    [ 21, 37, 73, 138, 152, 169, 0 ],
    [ 16, 47, 76, 130, 137, 154, 0 ],
    [ 3, 24, 30, 72, 104, 139, 0 ],
    [ 9, 40, 90, 106, 134, 151, 0 ],
    [ 15, 58, 60, 74, 111, 150, 163 ],
    [ 18, 42, 79, 144, 146, 152, 0 ],
    [ 25, 38, 65, 99, 122, 160, 0 ],
    [ 17, 42, 75, 129, 170, 172, 0 ]
];

// Number of rows in each parity check (kFTX_LDPC_Num_rows)
const LDPC_NUM_ROWS = [
    7, 6, 6, 6, 7, 6, 7, 6, 6, 7, 6, 6, 7, 7, 6, 6,
    6, 7, 6, 7, 6, 7, 6, 6, 6, 7, 6, 6, 6, 7, 6, 6,
    6, 6, 7, 6, 6, 6, 7, 7, 6, 6, 6, 6, 7, 7, 6, 6,
    6, 6, 7, 6, 6, 6, 7, 6, 6, 6, 6, 7, 6, 6, 6, 7,
    6, 6, 6, 7, 7, 6, 6, 7, 6, 6, 6, 6, 6, 6, 6, 7,
    6, 6, 6
];

const ARRL_SEC = "AB AK AL AR AZ BC CO CT DE EB EMA ENY EPA EWA GA GTA IA ID IL IN KS KY LA LAX MAR MB MDC ME MI MN MO MS MT NC ND NE NFL NH NL NLI NM NNJ NNY NT NTX NV OH OK ONE ONN ONS OR ORG PAC PR QC RI SB SC SCV SD SDG SF SFL SJV SK SNJ STX SV TN UT VA VI VT WCF WI WMA WNY WPA WTX WV WWA WY".split(' ');

// Gray code map (FTx bits -> channel symbols)
const GRAY_MAP = [0, 1, 3, 2, 5, 6, 4, 7];
const GRAY_INV = [0, 1, 3, 2, 6, 4, 5, 7];
const GRAY_OFF = [0, 1, 2, 3, 4, 5, 6, 7];


function symbolsToBitsStr(symbols) {
    return symbols.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

function symbolsToBitsStrPreserveSpaces(symbols) {
    return symbols.split('').map(s => (s === ' ') ? ' ' : GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

function symbolsToGrayBitsStr(symbols) {
    return symbols.split('').map(s => parseInt(s).toString(2).padStart(3, '0')).join('');
}

function symbolsToBitsStrNoCosta(symbols) {
   var symbolsWithoutCostas = symbols.slice(7, 36) + symbols.slice(43, 72);
   //return symbolsToBitsStr(symbolsWithoutCostas);
   return symbolsWithoutCostas.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

function bitsToSymbols(binaryString) {
    let symbols = "";
    
    if (binaryString.length % 3 !== 0) throw new Error("Bad input to bitsToSymbols");

    for (let i = 0; i < binaryString.length; i += 3) {
        const bits = binaryString.slice(i, i + 3);
        const decimal = parseInt(bits, 2);
        symbols += GRAY_MAP[decimal].toString();
    }
    return symbols;
}


function grayBitsToSymbols(graybits) {
    if (graybits.length % 3 !== 0) throw new Error("Bad input to grayBitsToSymbols");

    return graybits.match(/.{3}/g).map(b => parseInt(b, 2)).join('');
}

function binary237ToSymbols(binaryString) {
    return bitsToSymbols(binaryString);
}

function binary174ToSymbols(binaryString) {
    const sync = "3140652";
    //return sync.concat(bitsToSymbols(binaryString.slice(0, 29*3)).concat(sync).concat(bitsToSymbols( binaryString.slice(29*3, 58*3))).concat(sync);
    return `${sync}${bitsToSymbols(binaryString.slice(0, 29*3))}${sync}${bitsToSymbols(binaryString.slice(29*3, 58*3))}${sync}`;
}

function binary91ToSymbols(binaryString) { // 77 bits + CRC
    //const bits174 = binaryString.padEnd(174, '0')
    //const symbolsNoLDPC = binary174ToSymbols(bits174); 

    const ldpc = calculateParity(binaryString);

    //return binary174ToSymbols(binaryString + ldpc);
    return binary174ToSymbols(ldpc.fullCodeword);

}

function debugPrintMessageDetails(symbols) {
    if (!symbols || symbols.length === 0) {
        console.log("No symbols to print.");
        return;
    }
    if (!symbols.match(/^[0-7]*$/)) {
        console.log("Symbols contain invalid characters: ", symbols);
        return;
    }
    
    let bitString = symbolsToBitsStrNoCosta(symbols);

    if (symbols && symbols.length == 79) {
        console.log("Source-encoded message, 77 bits:\n"
         + bitString.slice(0, 77) + "\n\n"

         + "14-bit CRC: \n" 
         + bitString.slice(77, 91) + "\n\n"

         + "83 Parity bits\n"
         + bitString.slice(91)  + "\n\n"

         + "Channel symbols (79 tones):\n"
         + "  Sync               Data               Sync               Data               Sync\n"
         + symbolsPretty(symbols) + "\n\n");

         //console.log(symbols.slice(0, 7));
         console.log('graycode:', symbolsToGrayBitsStr(symbols));

    } else if (symbols && symbols.length > 0) {
        console.log(`Symbols (not 79): '${symbols}'`);
    }
}

function symbolsPretty(symbols) {
    return `${symbols.slice(0, 7)} ${symbols.slice(7, 36)} ${symbols.slice(36, 43)} ${symbols.slice(43, 72)} ${symbols.slice(72)}`
}

function symbolsToPrettyBinary(symbols) {
    return symbolsToBitsStrPreserveSpaces(symbolsPretty(symbols));
}

function symbols58ToSymbols79(symbols) {
    // adds missing costas
    if (symbols.length !== 58) {
        throw new Error("Invalid length (expected 58)");
    }
    return COSTAS_STR + symbols.slice(0, 29) + COSTAS_STR + symbols.slice(29, 58) + COSTAS_STR;
}

 // z-base-32: permutation of the RFC3548 standard.
const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';
const ZBASE32_Reverse = {};
for (let i = 0; i < ZBASE32.length; i++) {
    ZBASE32_Reverse[ZBASE32[i]] = i;
}

function bitsToZBase32(bits) {
    if (bits.length % 5 !== 0) {
        throw new Error("Invalid length");
    }
    let result = "";
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.slice(i, i + 5);
        result += ZBASE32[parseInt(chunk, 2)];
    }
    return result;
}
function hashBitsToZ32Dense(bits) { 
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aabcc
    // 12 bit: aab
    // 10 bit: aa
    const len = bits.length;
    if (len == 22) {
        return `${bitsToZBase32(bits.slice(0, 10))}${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}${bitsToZBase32(bits.slice(12, 22))}`;
    } else if (len == 12) {
        return `${bitsToZBase32(bits.slice(0, 10))}${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}`;
    } else if (len == 10) {
        return `${bitsToZBase32(bits.slice(0, 10))}`;
    } else if (len == 0) {
        return "";
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}

function hashBitsPrettyZ32(bits) {
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aa-b-cc
    // 12 bit: aa-b-00
    // 10 bit: aa-0-00
    const len = bits.length;
    if (len == 22) {
        return `${bitsToZBase32(bits.slice(0, 10))}-${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}-${bitsToZBase32(bits.slice(12, 22))}`;
    } else if (len == 12) {
        return `${bitsToZBase32(bits.slice(0, 10))}-${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}-00`;
    } else if (len == 10) {
        return `${bitsToZBase32(bits.slice(0, 10))}-0-00`;
    } else if (len == 0) {
        return "00-0-00";
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}


function hashBitsPrettyHex(bits) {
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aaa-b-ccc
    // 12 bit: aaa-b-xxx
    // 10 bit: aaa-x-xxx
    const len = bits.length;
    if (len == 22) {
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-${bitsToHex(bits.slice(10, 12).padStart(4, '0'))}-${bitsToHex(bits.slice(12, 22).padStart(12, '0'))}`;
    } else if (len == 12) {
        //return `xxx-${bitsToHex(bits.slice(0, 2).padStart(4, '0'))}-${bitsToHex(bits.slice(2, 10).padStart(12, '0'))}`;
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-${bitsToHex(bits.slice(10, 12).padStart(4, '0'))}-xxx`;
    } else if (len == 10) {
        //return `xxx-x-${bitsToHex(bits)}`;
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-x-xxx`;
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}

function hashBitsPretty(bits) {
    // 10, 12, or 22 bits

    // 0000000000 11 0000000000

    const len = bits.length;
    if (len == 22) {
        return `${bits.slice(0, 10)} ${bits.slice(10, 12)} ${bits.slice(12, 22)}`;
    } else if (len == 12) {
        return `${bits.slice(0, 10)} ${bits.slice(10, 12)} xxxxxxxxxx`;

    } else if (len == 10) {
        return `${bits.slice(0, 10)} xx xxxxxxxxxx`;
    }

    // other length/error
    return bits;
}

function hashBitsTo22styleBase10(bits) {
    // 22-bit hash in the style of hash22calc.exe (WSJT-X)
    // decimal value of the 22-bit hash, padded to 7 digits
    // does not make sense to use for 10 or 12-bit hashes

    if (typeof bits === 'number') { // accept numbers too
        return bits.toString().padStart(7, '0');
    }

    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }
    if (bits.length != 22) {
        throw new Error("Invalid length: " + bits.length + " in '" + bits + "'");
    }

    return parseInt(bits, 2).toString().padStart(7, '0');
}

function checkSync(symbols) {
    if (symbols.length !== 79) {
        throw new Error("Input must be 79 characters (symbols) long");
    }
    const syncPositions = [0, 36, 72];
    let errors = [];
    
    for (let i = 0; i < syncPositions.length; i++) {
        const syncPos = syncPositions[i];
        for (let j = 0; j < COSTAS_STR.length; j++) {
            if (symbols[syncPos + j] !== COSTAS_STR[j]) {
                errors.push(syncPos + j);
            }
        }
    }
    
    return {
        result: errors.length === 0 ? 'ok' : 'error',
        errors: errors // list of bad symbols
    };
}

function ftx_compute_crc(message, num_bits) {
    const FT8_CRC_WIDTH = 14;
    const FT8_CRC_POLYNOMIAL = 0x2757;  // 14-bit CRC polynomial without the leading 1
    const TOPBIT = 1 << (FT8_CRC_WIDTH - 1);

    let remainder = 0;
    let idx_byte = 0;

    // Perform modulo-2 division, a bit at a time.
    for (let idx_bit = 0; idx_bit < num_bits; ++idx_bit) {
        if (idx_bit % 8 === 0) {
            // Bring the next byte into the remainder.
            remainder ^= (message[idx_byte] << (FT8_CRC_WIDTH - 8));
            ++idx_byte;
        }

        // Try to divide the current data bit.
        if (remainder & TOPBIT) {
            remainder = (remainder << 1) ^ FT8_CRC_POLYNOMIAL;
        } else {
            remainder = (remainder << 1);
        }
    }

    return remainder & ((TOPBIT << 1) - 1);
}

function checkCRC(symbols) {
    let bitString = symbolsToBitsStrNoCosta(symbols);
    let msgBits = bitString.slice(0, 77).padEnd(82, '0').split('').map(Number);
    
    // Convert bit array to byte array
    let messageBytes = [];
    for (let i = 0; i < 82; i += 8) {
        messageBytes.push(parseInt(msgBits.slice(i, i + 8).join(''), 2));
    }
    
    let calculatedCRC = ftx_compute_crc(messageBytes, 82);
    let receivedCRC = parseInt(bitString.slice(77, 91), 2);

    return {
        crc: calculatedCRC.toString(2).padStart(14, '0'),
        received: receivedCRC.toString(2).padStart(14, '0'),
        result: calculatedCRC === receivedCRC ? 'ok' : 'error'
    };
}

function checkParity(symbols) {
    let bits = symbolsToBitsStrNoCosta(symbols).slice(0, 174).split('').map(Number);  // We need all 174 bits
    
    let failedParityBits = new Set();
    let failedMessageBits = []; // can contain duplicates

    // Check parity equations
    for (let i = 0; i < LDPC_MATRIX.length; i++) {
        let sum = 0;
        for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
            let bitIndex = LDPC_MATRIX[i][j] - 1;  // Adjust for 0-based indexing
            if (bitIndex >= 0 && bitIndex < 174) {
                //sum ^= bits[bitIndex] === '0' ? 0 : 1;
                sum ^= bits[bitIndex];
            }
        }
        if (sum !== 0) {
            failedParityBits.add(i);
            for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
                let bitIndex = LDPC_MATRIX[i][j] - 1;
                //if (bitIndex >= 0 && bitIndex < 91) {  // Only include message bits
                    failedMessageBits.push(bitIndex);
                //}
            }
        }
    }

    return {
        result: failedParityBits.size === 0 ? 'ok' : 'error',
        success: failedParityBits.size === 0,
        failedParityCount: failedParityBits.size,
        failedMessageCount: failedMessageBits.size,
        parityErrors: failedParityBits,
        messageErrors: (failedMessageBits.length > 0) ? analyzeNumbers(failedMessageBits) : null, // { frequencyMap, uniqueNumbers, mostFrequentNumbers }
    };
}

function calculateParity(binaryString) {
    if (binaryString.length !== 91) {
        throw new Error("Input must be 91 bits long (77 message bits + 14 CRC bits)");
    }

    let messageBits = binaryString.split('').map(Number);
    let parityBits = new Array(83).fill(0);

    // Convert message bits to bytes
    let messageBytes = [];
    for (let i = 0; i < 91; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < 91; j++) {
            byte |= messageBits[i + j] << (7 - j);
        }
        messageBytes.push(byte);
    }

    // Calculate parity bits using generator matrix
    for (let i = 0; i < 83; i++) {
        for (let j = 0; j < 12; j++) {
            let generatorByte = kFTX_LDPC_generator[i][j];
            for (let k = 0; k < 8; k++) {
                if (j * 8 + k < 91) {
                    parityBits[i] ^= ((generatorByte >> (7 - k)) & 1) & messageBits[j * 8 + k];
                }
            }
        }
    }

    // Combine message bits and parity bits
    let fullCodeword = messageBits.concat(parityBits);

    return {
        parityBits: parityBits.join(''),
        fullCodeword: fullCodeword.join('')
    };
}

//TODO: roll this into calculateParity
function analyzeNumbers(numbers) {
    // Count occurrences of each number
    const frequencyMap = new Map();
    for (const num of numbers) {
      frequencyMap.set(num, (frequencyMap.get(num) || 0) + 1);
    }
  
    // Find the maximum frequency
    const maxFrequency = Math.max(...frequencyMap.values());
  
    // Create sets
    const uniqueNumbers = new Set(numbers);
    const mostFrequentNumbers = new Set(
      [...frequencyMap.entries()]
        .filter(([_, frequency]) => frequency === maxFrequency)
        .map(([number, _]) => number)
    );
  
    return {
      frequencyMap,
      uniqueNumbers,
      mostFrequentNumbers
    };
}

function repairErrorsOnce(codewordBits, parityCheck) {
    // naively repair codeword by flipping the most frequent error bits in the LDPC parity check
    // does not check if repair leads to parity check passing
    
    if (parityCheck.success) return null; // codewordBits; // nothing to repair
    const flip = parityCheck.messageErrors.mostFrequentNumbers;
    const flipped = codewordBits.split('').map((element, index) => { 
        if (flip.has(index)) return element === '0' ? '1' : '0';
        return element;
    }).join('');
        console.log('flip:', flip, 'flipped:', flipped);
    return flipped;
}

// not used / tested
function decodeFT8FreeTextPayload(payload) {
    if (!(payload instanceof Uint8Array) || payload.length !== 10) {
        throw new Error("Invalid payload: must be a Uint8Array of length 10");
    }

    // Extract the 71 bits of free text data
    let n71 = BigInt(0);
    for (let i = 0; i < 9; i++) {
        n71 = (n71 << BigInt(8)) | BigInt(payload[i]);
    }

    // Decode the text
    let text = "";
    for (let i = 0; i < 13; i++) {
        let index = Number(n71 % BigInt(42));
        text = FT8_CHAR_TABLE_FULL[index] + text;
        n71 = n71 / BigInt(42);
    }

    // Trim trailing spaces
    text = text.trimEnd();

    return text;
}

// Convert 71 bits of free text to a string
function bitsToText(bits) {
    if (bits.length !== 71) throw new Error("Free text must be 71 bits");
    
    let text = "";
    let n = BigInt("0b" + bits);
    const charTable = FT8_CHAR_TABLE_FULL;
    
    for (let i = 0; i < 13; i++) {
        let charIndex = Number(n % 42n);
        text = charTable[charIndex] + text;
        n = n / 42n;
    }
    
    return text.trim();
}


// Example usage
//const payload = new Uint8Array([0x17, 0x6C, 0x5D, 0xB8, 0x73, 0x7F, 0x8A, 0x49, 0x30, 0x00]);
//console.log(decodeFT8FreeText(payload));

function encodeFT8FreeText(message) {
  const MAX_LEN = 13;
  // Ensure the message is no longer than 13 characters
  message = message.slice(0, MAX_LEN).toUpperCase();
  
  // Pad the message to 13 characters with spaces
  message = message.padStart(MAX_LEN, ' ');

  // Initialize the result as a BigInt
  let result = 0n;
  
  // Encode each character
  for (let i = 0; i < MAX_LEN; i++) {
    const charIndex = FT8_CHAR_TABLE_FULL.indexOf(message[i]);
    if (charIndex === -1) {
      throw new Error(`Invalid character for free text: ${message[i]}`);
    }
    result = result * 42n + BigInt(charIndex);
  }
  
  // Convert to 71-bit binary string
  let binaryString = result.toString(2).padStart(71, '0');

  // message type 0.0 (6 bits) + 3 bits padding to get to 80
  binaryString = binaryString + '000000000';

  // Convert binary string to Uint8Array
  const output = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    output[i] = parseInt(binaryString.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return output;
}

// Encode hex to 71-bits of telemetry data in a 77-bit payload
function encodeFT8Telemetry(telemetryHex) {
  
  if (!/^[0-9A-Fa-f]{1,18}$/.test(telemetryHex)) {
    return { "error": "Telemetry data must be a 1 to 18 character hex string" };
  }

  let binaryString = hexToBinary(telemetryHex); // leading 0's are trimmed

  // Check if the binary string starts with 1 (exceeding 71 bits)
  if (binaryString.length > 71) { // || binaryString[0] == '1'
    return { "error": "First digit of 18-character hex string telemetry data must fall in the range 0 to 7." };
  }

  binaryString = binaryString.padStart(71, '0') + '101000' // message type 0.5

  // Convert binary string back to hex string
  return { "result": bitsToHexForTelemetry(binaryString, true) };
}

// Decode 71-bit telemetry data (untested; done by ft8_lib already)
function decodeFT8Telemetry(payload) {
  if (!(payload instanceof Uint8Array) || payload.length !== 10) {
    throw new Error("Invalid payload: must be a Uint8Array of length 10");
  }

  // Extract the binary string
  let binaryString = '';
  for (let i = 0; i < 10; i++) {
    binaryString += payload[i].toString(2).padStart(8, '0');
  }

  // Remove the last 6 bits (message type)
  binaryString = binaryString.slice(0, -6);

  // Convert binary to hex
  const telemetryHex = bitsToHexForTelemetry(binaryString);

  return telemetryHex;
}

function telemetryBitsToText(bits) {
    if (bits.length !== 71) throw new Error("Telemetry must be 71 bits");

    // pad the start
    bits = bits.padStart(Math.ceil(bits.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < bits.length; i += 4) {
        let fourBits = bits.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }

    return hexString;
}

function telemetryBitsToByteText(bits) {
    bits = bits.padStart(Math.ceil(bits.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < bits.length; i += 4) {
        let fourBits = bits.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }

    hexString.padStart(2, '0');
    return hexString;
}

function telemetryByteAnnotations() {
    const skipOnFirst = 1;
    const totalLen = 71;
    let annotations = [];
    let n = 0;
    let len = 7; // skip first bit

    for (let i = 0; i < totalLen; i += len) {
        if (n==1) len = 8;
        annotations.push( { label: `byte[${n}]`, start: i, length: len, getValue: telemetryBitsToByteText} );
        n++;
    }

    return annotations;
}

function packedToHexStr(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function packedToHexStrSp(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
}

function packedDataTo80Bits(packedData) {
    if (packedData.length !== 10) {
        throw new Error("Invalid packed data: must be a Uint8Array of length 10");
    }
    return Array.from(packedData).map(b => b.toString(2).padStart(8, '0')).join('');
}

function bitsToHexForTelemetry(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    // not sure if it should be start or end?
    binaryStr = binaryStr.padEnd(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
        let fourBits = binaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}


function bitsToHex(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    binaryStr = binaryStr.padStart(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
        let fourBits = binaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}


function bitsToPacked(bitString) {
    if (bitString.length != 80 && bitString.length != 77) {
        throw new Error("Invalid length to pack: must be 77 or 80 bits");
    }
    const bits = normalizeBinary(bitString).padEnd(80, '0');

    return Uint8Array.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
}

// Helper function to convert hex string to binary string
function hexToBinary(hex) {
  return hex.split('').map(char => 
    parseInt(char, 16).toString(2).padStart(4, '0')
  ).join('').replace(/^0*/g, '');
}

function arrayToSymbols(toneArray) {
  // Convert the Uint8Array to a regular array of numbers
  const numbers = Array.from(toneArray);
  
  // Convert numbers back to string characters
  const tones = numbers.map(num => num.toString());
  
  // Join the array into a single string
  return tones.join('');
}

function symbolsToArray(toneString) {
  // Remove any whitespace and split the string into an array of characters
  const tones = toneString.replace(/\s/g, '').split('');
  
  // Convert characters to numbers and filter out any NaN values
  const arrayTones = tones.map(tone => parseInt(tone, 10))
                          .filter(num => !isNaN(num));
  
  return new Uint8Array(arrayTones);
}

function symbolsToPackedData(symbolsText) {
  // returns Uint8Array

  const messageBits = symbolsToBitsStrNoCosta(symbolsText).slice(0, 77).padEnd(80, '0');
  const packedData = new Uint8Array(10);
  
  for (let i = 0; i < 10; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (i * 8 + j < messageBits.length) {
        byte |= (messageBits[i * 8 + j] === '1' ? 1 : 0) << (7 - j);
      }
    }
    packedData[i] = byte;
  }
  // debug:
  //console.log('symbolsText, messageBits, packedData', symbolsText, messageBits, packedData);

  return packedData;
}


/**
 * Extracts the FT8 message type from packed message data.
 * 
 * This function interprets the last 6 bits of a 77-bit FT8 message payload:
 * - Bits 74-76 (i3) determine the primary message type (0-7)
 * - For type 0, bits 71-73 (n3) determine the subtype (0.0 - 0.7)
 * 
 * The function returns the type as a string:
 * - "0.0" to "0.7" for type 0 messages
 * - "1" to "7" for other types
 * - "-" for invalid or insufficient input data
 * 
 * @param {Uint8Array} packedData - The packed 77-bit message payload (10 bytes)
 * @returns {string} The extracted message type
 */
function getFT8MessageType(packedData) {
    if (!packedData || packedData.length < 10) {
        return "-";
    }
    
    const i3 = (packedData[9] >> 3) & 0x07;
    
    if (i3 === 0) {
         // n3: bit[72] to bit[74] of end-padded 77-bit payload
        const n3 = ((packedData[9] >> 6) & 0x03) | ((packedData[8] << 2) & 0x04);
        return `0.${n3}`;
    }
    
    return i3.toString();
}

function getFT8MessageTypeName(type) {
    switch (type) {
        case "0.0": return "Free text message";
        case "0.1": return "DXpedition mode";
        case "0.2": return "Unknown / Reserved";
        case "0.3": return "Field Day";
        case "0.4": return "Field Day";
        case "0.5": return "Telemetry";
        case "0.6": return "WSPR";
        case "0.7": return "Unknown / Reserved";
        case "1": return "Standard message";
        case "2": return "EU VHF";
        case "3": return "ARRL RTTY Roundup";
        case "4": return "Non-standard callsign";
        case "5": return "EU VHF with 6-digit grid locator";
        case "6": return "Unknown / Reserved";
        case "7": return "Unknown / Reserved";
        default: return "Unknown";
    }
}


function binaryToInt(binary) {
    return parseInt(binary, 2);
}

function bitsToCall(bits) {
    return  bitsToCallDetails(bits);
    
    //const details = bitsToCallDetails(bits);
    //return `${details.callsign} (${details.type})`;
}

const FT8_CHAR_TABLE_ALPHANUM_SPACE_SLASH = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/";

function nchar(char, table) {
    return table.indexOf(char);
}

function hashCallsign(callsign) {
    let n58 = BigInt(0);
    const maxLength = Math.min(callsign.length, 11);

    for (let i = 0; i < maxLength; i++) {
        const j = nchar(callsign[i], FT8_CHAR_TABLE_ALPHANUM_SPACE_SLASH);
        if (j < 0) {
            console.error("Invalid character in callsign: " + callsign[i]);
            return null; // hash error (wrong character set)
        }
        n58 = (BigInt(38) * n58) + BigInt(j);
    }

    // Pretend to have trailing whitespace
    for (let i = maxLength; i < 11; i++) {
        n58 = BigInt(38) * n58;
    }

    const multiplier = BigInt("47055833459");
    const n22 = Number((multiplier * n58) >> BigInt(42) & BigInt(0x3FFFFF));

    return n22;
}

function callsignToHashBits(bits) {
    return hashCallsign(bits).toString(2).padStart(22, '0');
}

// Convert 28 bits to a callsign
function bitsToCallDetails(bits, extraBit = "") {
    if (bits.length !== 28 && bits.length !== 29) throw new Error("Callsign must be 28 or 29 bits");

    extraOn = (bits.length === 29 && bits[28] === '1');
    bits = bits.slice(0, 28);

    const n = parseInt(bits, 2);
    
    const NTOKENS = 2063592;  // Number of special tokens
    const MAX22 = 4194304;    // 2^22, maximum 22-bit hash value

    let result = {
        subtype: null,
        value: null,
        details: {}
    };

    if (extraOn) result.extra = extraBit; // TODO: add "/R" or "/P" etc to call if using 29 bits.

    if (n < NTOKENS) {
        result.subtype = 'special token';
        if (n === 0) {
            result.value = "DE";
        } else if (n === 1) {
            result.value = "QRZ";
        } else if (n === 2) {
            result.value = "CQ";
        } else if (n < 1003) {
            result.value = `CQ ${(n - 3).toString().padStart(3, '0')}`;
            result.details.number = n - 3;
        } else if (n < 532444) {
            let code = n - 1003;
            let call = "";
            for (let i = 0; i < 4; i++) {
                const charIndex = code % 27;
                call = (charIndex === 0 ? ' ' : String.fromCharCode(charIndex + 64)) + call;
                code = Math.floor(code / 27);
            }
            result.value = `CQ ${call.trim()}`;
            result.details.alphabeticCode = call.trim();
            result.subtype = 'directed CQ'
        } else {
            result.subtype = 'undefined';
            result.value = '';
        }
    }
    // Check for 22-bit hash
    else if (n < NTOKENS + MAX22) {
        result.subtype = 'hash22';
        //result.desc = 'Displayed in Z-Base32 encoding'
        const hashValue = n - NTOKENS;
        //result.details.hashValue = hashValue
        //result.callsign = "<...>";
        const subBits = hashValue.toString(2).padStart(22, '0');
        result.isHash = true;
        result.hashBits = subBits;
        result.hashLen = 22;
        result.value = hashBitsPrettyZ32(subBits); // for bit viz display
        result.rawAppend = `22-bit hash: ${hashBitsPretty(subBits)} (=${hashBitsTo22styleBase10(subBits)})`;

        const matchDetails = hashMatchDetails(subBits);
        if (matchDetails) result = {...result, ...matchDetails};

    }  else {
        // Standard callsign

        result.subtype = 'standard call';
        let c = n - NTOKENS - MAX22;

        const subBits = c.toString(2).padStart(22, '0');
        result.rawAppend = `22-bit call: ${subBits} (=${bitsToBigIntString(subBits)})`;

        // Decode last 3 characters (from right to left)
        let suffix = '';
        for (let i = 0; i < 3; i++) {
            const charCode = c % 27;
            suffix = (charCode === 0 ? '' : String.fromCharCode(charCode + 64)) + suffix;
            c = Math.floor(c / 27);
        }
        result.details.suffix = suffix;

        // Decode digit (always present)
        const digit = c % 10;
        result.details.digit = digit;
        c = Math.floor(c / 10);

        // Decode second character
        const secondChar = c % 36;
        result.details.secondChar = secondChar < 10 ? secondChar.toString() : String.fromCharCode(secondChar - 10 + 65);
        c = Math.floor(c / 36);

        // Decode first character (may be empty)
        const firstChar = c % 37;
        result.details.firstChar = firstChar === 0 ? '' : 
                                   (firstChar <= 10 ? (firstChar - 1).toString() : 
                                   String.fromCharCode(firstChar - 11 + 65));

        // Construct full callsign
        result.value = result.details.firstChar + result.details.secondChar + 
                          result.details.digit + result.details.suffix;

        // Handle special prefixes TODO check this is correct/real
        if (result.value.startsWith('3D0') && result.value.length > 4) {
            result.value = '3DA0' + result.value.slice(3);
            result.details.specialPrefix = '3DA0';
            result.subtype = 'special prefix callsign';

        } else if (result.value.startsWith('3X0') && result.value.length > 4) {
            result.value = 'Q' + result.value.slice(1);
            result.details.specialPrefix = 'Q';
            result.subtype = 'Q code / callsign';
        }

        const country = callsignToCountry(result.value);
        result.country = country;
        
        const hashBits = callsignToHashBits(result.value)
        result.hashBits = hashBits;
        result.hashLen = hashBits?.length; // 22
        result.isHash = false;

        result.callsign = result.value;
    }

    return result;
}

function callsignToCountry(call) {
    if (typeof cty !== 'undefined' && cty) {
        const countryDetails = cty.getCountryDetails(call);
        if (countryDetails) {
            return countryDetails.country;
        }
    }
    return null;
}

function callsignToCountryDetails(call) {
    if (typeof cty !== 'undefined' && cty) {
        const countryDetails = cty.getCountryDetails(call);
        return countryDetails;
    }
    return null;
}


function hashMatchDetails(bits) {
    const match = findHash(bits);
    if (match) {
        let result = {};
        //result.isHash = true; // shouldn't be needed
        result.hashMatch = match;
        result.hashBits = match.hashBits // give full bits in case only had parital
        result.hashLen = bits.length; // should be done already by caller, but make sure it's set to original length for underlining
        result.actualHashBits = bits; // save old value

        result.callsign = match.callsign;
        if (match.callsign == '') result.unhashed = '(blank)';
        
        result.country = callsignToCountry(match.callsign);

        return result;
    }
    return null;
}

function isGrid4(grid) {
    return grid.length === 4 &&
           grid[0] >= 'A' && grid[0] <= 'R' &&
           grid[1] >= 'A' && grid[1] <= 'R' &&
           grid[2] >= '0' && grid[2] <= '9' &&
           grid[3] >= '0' && grid[3] <= '9';
}

function bitsToHash(bits) {

    const matchDetails = hashMatchDetails(bits) ?? {};

    // desc: 'Displayed in Z-Base32 encoding'
    //note: hashBits may be overriden by matchDetails.hashBits, which will have the full 22 bits if a match is found
    return { hashBits: bits, value: hashBitsPrettyZ32(bits), ...matchDetails, isHash: true, hashLen: bits.length, subtype:'hash' + bits.length };
}


// not used
function grid4ToG15(input) {
    if (isGrid4(input) && input !== 'RR73') {
        let j1 = (input.charCodeAt(0) - 'A'.charCodeAt(0)) * 18 * 10 * 10;
        let j2 = (input.charCodeAt(1) - 'A'.charCodeAt(0)) * 10 * 10;
        let j3 = (input.charCodeAt(2) - '0'.charCodeAt(0)) * 10;
        let j4 = (input.charCodeAt(3) - '0'.charCodeAt(0));
        return j1 + j2 + j3 + j4;
    } else {
        let c1 = input[0];
        if (c1 !== '+' && c1 !== '-' && input !== 'RRR' && input !== 'RR73' && 
            input !== '73' && input.trim().length !== 0) {
            throw new Error('Invalid input');
        }
        
        let irpt;
        if (c1 === '+' || c1 === '-') {
            irpt = parseInt(input) + 35;
        } else if (input.trim().length === 0) {
            irpt = 1;
        } else if (input === 'RRR') {
            irpt = 2;
        } else if (input === 'RR73') {
            irpt = 3;
        } else if (input === '73') {
            irpt = 4;
        } else {
            throw new Error('Invalid input');
        }
        return MAXGRID4 + irpt;
    }
}

function bitsToGrid4OrReportWithType(bits) {
    return bitsToGrid4OrReportDetails(bits);
    //const details = bitsToGrid4OrReportDetails(bits)
    //return `${details.result} (${details.type})`;
}

function bitsToGrid4OrReport(bits) {
    return bitsToGrid4OrReportDetails(bits).result;
}

function bitsToGrid4OrReportDetails(bits) {
    if (bits.length !== 15) throw new Error("Grid/Report must be 15 bits");
    
    const g15 = parseInt(bits, 2);
    
    if (g15 < MAXGRID4) {
        let j1 = Math.floor(g15 / 1800);
        let remainder = g15 % 1800;
        let j2 = Math.floor(remainder / 100);
        remainder = remainder % (100);
        let j3 = Math.floor(remainder / 10);
        let j4 = remainder % 10;

        let ret = { value: String.fromCharCode('A'.charCodeAt(0) + j1) +
               String.fromCharCode('A'.charCodeAt(0) + j2) +
               j3.toString() +
               j4.toString(), subtype: 'Maidenhead locator' };
        const latlon = latLonForGrid(ret.value);
        let desc = `latitude, longitude: ${latlon.lat}, ${latlon.lon}`;
        if (ret.value == 'RR73') {
            desc += "\n*RR73 is short for 'report received and best regards'. It can also be encoded with a special token, but here has been encoded as a location.";
            ret.subtype += '*';
        } else if (ret.value == 'RG58') {
            desc += "\nRG-58/U is a type of coaxial cable often used for low-power signal and RF connections."
        } else if (ret.value == 'FB73') {
            desc += "\nFB in amateur radio slang means 'fine business' or 'excellent', which combines with '73' for 'best regards'. FB73 is in Antarctica.";
            ret.subtype += '*';
        }
        return { ...ret, ...latlon, desc };
        
    } else {
        const irpt = g15 - MAXGRID4;
        const also = {rawAppend: `Overgrid: ${irpt}`};
        //if (irpt === 0) return { value: '', subtype: 'unknown / reserved', subtype: 'special token', ...also}; // TODO: official meaning? lib_ft8 packs -35 dB to this.
        if (irpt === 1) return { value: '', subtype: 'blank', ...also};
        if (irpt === 2) return { value: 'RRR', long: 'RRR (reception report received)', subtype: 'special token', desc: 'RRR is short for "reception report received"', ...also };
        if (irpt === 3) return { value: 'RR73', subtype: 'special token', desc: 'RR73 is short for "report received and best regards"', ...also };
        if (irpt === 4) return { value: '73', subtype: 'special token', desc: '73 is short for "best regards"', ...also };

        //let value = (irpt - 35);
        //if (value >= 50) value -= 101; // db over 50 is folded negative
        const value = (irpt >= 85) ? (irpt - 136) : (irpt - 35);

        // irpt 5 to 84: regular: -30 to 49 dB; (irpt-35 db)
        if (irpt >= 85) also.unhashed = 'low signal'; // -51 to -29 dB (irpt-136 db) -- if treated like regular, would be 50 to 72 dB
        if (irpt >= 106) also.unhashed = 'ambiguous'; // -30 to 49 dB again (irpt-136 db) -- if treated like regular, would be 73 to 150 dB
        if (irpt >= 207) also.unhashed = 'very high'; // 50 to 231 dB -- if treated like regular, would be 151 to 332 dB

        //return { value, subtype: 'signal report', units: 'dB', ...also };
        // in lib_ft8 -35 dB (irpt: 0) also works? probably a bug
        // in (lib_ft8 v2.00): .\gen_ft8.exe "AA9GO VK3PGO R-31" "temp.wav" wraps to give '73' special token 
        // way out of range: -32 gives 'RR73' special token // -62 gives RR73 maidenhead
        // [fixed in ft8play] in ft8code.exe "aa9go vk3pgo R-31" gives 70 dB; Raw value: 111111011111001 (=32505) irpt: 105 -- should give -31 dB; 

        // in ft8code (wsjtx), -35 dB gives (irpt: 101 or 66 dB) ft8code.exe "aa9go vk3pgo R-35" gives 66 dB

        //const minVal = -30; // only the lowest value before the smaller lowest values
        const minVal = -51;  // 50 - 101

         //332: Raw value: 111111111111111 (=32767) irpt: 367; TODO: check spec and implementations if this is allowed or if higher dB numbers reserved
         // 99 dB is highest you can enter with ft8_lib
        // .\gen_ft8.exe "AA9GO VK3PGO R+100" "temp.wav" gives 10 dB (additional characters are truncated); '999' -> 99 dB
        // unpacking with lib_ft8 gives odd output: R+332 becomes R+Q2
        // in ft8code (wsjtx), ".\ft8code.exe "aa9go vk3pgo R+333" gives "*** bad message ***"" (correctly)
        //322 example: 525a67b7104522bfffc8

        //const maxVal = 49; // ought to be the max
        //const maxVal = 332; // max if ignore the fold
        const maxVal = 231;
        
        return { ...signalReportDetails(value, minVal, maxVal), ...also };
    }
}

function bitsToReport(bits) {
    // r5 Report: -30 to +32, even numbers only

    if (bits.length !== 5) throw new Error("Report must be 5 bits");
    const n = parseInt(bits, 2); // 0 to 31
    const value = ((n * 2) - 30);
    //return { value, subtype: 'signal report', units: 'dB' }; // desc: 'Possible values: –30 to +32 dB'
    return signalReportDetails(value, -30, 32);
}

function signalReportDetails(dbValue, min = null, max = null) {

    function formatToSigFigs(num, sigFigs) {
        if (num === 0) return '0';
        const magnitude = Math.floor(Math.log10(Math.abs(num))) + 1;
        const scale = Math.pow(10, sigFigs - magnitude);
        if (num >= 1e21) { // For silly large numbers
            const magnitude = Math.floor(Math.log10(num));
            const rounded = Math.round(num / Math.pow(10, magnitude - sigFigs + 1)) * Math.pow(10, magnitude - sigFigs + 1);
            return rounded.toLocaleString('fullwide', {useGrouping: true});
        }

        return (Math.round(num * scale) / scale).toString();
    }

    function formatNumber(num, sigFigs) {
        if (num >= 1e6 || num <= 1e-4) {
            const exponent = Math.floor(Math.log10(num) / 3) * 3;
            const base = num / Math.pow(10, exponent);
            return `${formatToSigFigs(base, sigFigs)}×10<sup>${exponent}</sup>`;
        }
        return formatToSigFigs(num, sigFigs);
    }

    let note = '';
    if (min != null && dbValue == min) note = ', which is the minimum possible for this field';
    if (max != null && dbValue == max) note = ', which is the maximum possible for this field';

    let explain = ''
    if (dbValue < 0) {
        explain = `Signal is reported as ${Math.abs(dbValue)} dB below the noise floor${note}.`;
    } else if (dbValue == 0) {
        explain = `Signal is reported as being at the same level as the noise floor${note}.`;
    } else {
        explain = `Signal is reported as +${dbValue} dB above the noise floor${note}.`;
    }

    const powerRatio =  Math.pow(10, dbValue / 10); // calculatePowerRatioFromDb(dbValue);
    
    const ratioSignificantFigures = 2;
    const expSignificantFigures = 2;

    // Format the "x:1" or "1:y" ratio
    let formattedRatio;
    if (powerRatio >= 1) {
      formattedRatio = formatToSigFigs(powerRatio, ratioSignificantFigures) + ':1';
    } else {
      formattedRatio = '1:' + formatToSigFigs(1 / powerRatio, ratioSignificantFigures);
    }

    // Format the power ratio
    let formattedPowerRatio = formatNumber(powerRatio, expSignificantFigures);
    let orScientific = (dbValue < 0 || formattedPowerRatio.includes('<sup>')) ? ` or ${formattedPowerRatio}` : '';

    explain += ` Power ratio: <span title="${powerRatio}">${formattedRatio}${orScientific}</span>.`;

    explain += '<br>The Signal to Noise Ratio (SNR) quoted for amateur radio modes is traditionally based on a receiver bandwidth of 2500 Hz, a far wider noise bandwidth than is required to successfully demodulate and decode the message.';

    let subtype = 'signal report';

    if (dbValue == 73) {
        explain = "73 is short for 'best regards'. It can also be encoded with a special token, but here has been encoded as a signal report.<br>" 
            + explain;
        subtype += '*';

    } else if (dbValue == 88) {
        explain = "88 is short for 'love and kisses', and here has been encoded as a signal report.<br>" 
            + explain;
        subtype += '*';
    }

    return { 
        value: dbValue.toString(), 
        subtype,
        units: 'dB', 
        descNoEsc: explain 
    }
}

function calculatePowerRatioFromDb(dbValue) {
    return Math.pow(10, dbValue / 10);
}

function bitsToR2(bits) { // aka bitsToRR73
    // 2 bits, 0 to 3
    if (bits.length !== 2) throw new Error("R2 must be 2 bits");
    //RRR, RR73, 73, or blank (but not in that order)
    
    if (bits === '00') return '';
    if (bits === '01') return 'RRR';
    if (bits === '10') return 'RR73';
    if (bits === '11') return '73';

    throw new Error("Invalid R2 bits");
}

function bitsToNonstandardCallDetails(bits, message) {
    const callsign = bitsToNonstandardCall(bits);
    const hashBits = callsignToHashBits(callsign);
    const country = callsignToCountry(callsign);

    return { 
        callsign, 
        value: callsign,
        subtype: 'non-standard callsign',
        hashBits,
        isHash: false,
        country,
    };
}


function bitsToNonstandardCall(bits) {
    const c = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/';
    let n58 = BigInt('0b' + bits);
    let callsign = '';
  
    for (let i = 0; i < 11; i++) {
      let index = Number(n58 % 38n);
      callsign = c[index] + callsign;
      n58 = n58 / 38n;
    }
  
    return callsign.trim();
}

function bitsToFieldDayClass(bits) {
    //k3 Field Day Class: A, B, ... F
    return String.fromCharCode('A'.charCodeAt(0) + parseInt(bits, 2));
}

function bitsToARRLSection(bits) {
    if (bits.length !== 7) throw new Error("ARRL Section must be 7 bits");
    const n = parseInt(bits, 2);;
    if (n == 0) {
        return '';
    }
    
    const i = n-1;
    if (i < 0 || i >= ARRL_SEC.length) {
        //return "Invalid ARRL Section";
        return `Section ${n}`;
    }
    return ARRL_SEC[i];
}

function bitsToTxDetailsLow(bits) {
    // n4 Number of transmitters: 1-16
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const low = `${n + 1}`;
    return { value: low, subtype: 'transmitter(s)'};
}

function bitsToTxDetailsHigh(bits) {
    // n4 Number of transmitters: 17-32
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const high = `${n + 17}`;
    return { value: high, subtype: 'transmitter(s)'};
}

function bitsToTxDetails(bits) {
    // n4 Number of transmitters: 1-16, 17-32
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const low = `${n + 1}`;
    const high = `${n + 17}`;
    return { value: low, short: low, long: `${low} or ${high}`, subtype: 'transmitter(s)', desc: `This value may refer to ${low} or ${high} transmitter(s)` };
}

function bitsToRST(bits) {
    //r3 Report: 2-9, displayed as 529 – 599 or 52 - 59
    if (bits.length !== 3) throw new Error("RST must be 3 bits");
    const n = parseInt(bits, 2) + 2;
    //return `5${n} or 5${n}9`;
    const low = `5${n}`;
    const high = `5${n}9`;
    return { value: high, short: low, long: `${low} or ${high}`, subtype:'RST', desc: `May refer to ${low} or ${high}` };

}

function bitsToBigIntString(binaryString) {
    // convert bit string to an integer display.
    // works for long strings.

    const MAX_SAFE_LENGTH = 52; // JavaScript's max safe integer is 2^53 - 1
    
    if (binaryString.length <= MAX_SAFE_LENGTH) {
        return parseInt(binaryString, 2).toString();
    }

    let decimal = '0';
    const binaryLength = binaryString.length;

    for (let i = 0; i < binaryLength; i++) {
        if (binaryString[i] === '1') {
            // Calculate 2^(binaryLength - 1 - i)
            let power = '1';
            for (let j = 0; j < binaryLength - 1 - i; j++) {
                power = addStrings(power, power);
            }
            decimal = addStrings(decimal, power);
        }
    }

    return decimal;
}

function addStrings(num1, num2) {
    let i = num1.length - 1;
    let j = num2.length - 1;
    let carry = 0;
    let result = '';

    while (i >= 0 || j >= 0 || carry > 0) {
        const digit1 = i >= 0 ? parseInt(num1[i]) : 0;
        const digit2 = j >= 0 ? parseInt(num2[j]) : 0;
        const sum = digit1 + digit2 + carry;
        result = (sum % 10) + result;
        carry = Math.floor(sum / 10);
        i--;
        j--;
    }

    return result;
}

function addUnderlineToHash(hashBits, numBitsToUnderline, classname = "call-highlighter") {
    if (hashBits == null || hashBits.length == 0) return '';

    const zhash = hashBitsPrettyZ32(hashBits);
    if (numBitsToUnderline == null ||  numBitsToUnderline == 0) return zhash;

    let bitLen = numBitsToUnderline ?? hashBits?.length ?? 0;
    let uLen = zhash.length;
    //if (bitLen == 22) underlineLen = 6;
    if (bitLen == 12) uLen = 4;
    if (bitLen == 10) uLen = 2;

    return addSpanToStart(zhash, uLen, classname);
}

//utility for underlining text
function addSpanToStart(str, charCount, classname) {
    if (charCount <= 0) {
      return str;
    }

    const len = charCount > str.lengt ? str.length : charCount;
    
    const spanContent = str.slice(0, len);
    const remainder = str.slice(len);
    
    return `<span class="${classname}">${spanContent}</span>${remainder}`;
  }