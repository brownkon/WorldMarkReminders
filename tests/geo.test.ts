import { describe, it, expect } from 'vitest';
import { distanceMiles, boundingBox } from '../src/utils/geo';

describe('Geo Utilities', () => {
    describe('distanceMiles', () => {
        it('should return 0 for the same point', () => {
            const dist = distanceMiles(33.4484, -112.0740, 33.4484, -112.0740);
            expect(dist).toBe(0);
        });

        it('should calculate distance between Phoenix and Scottsdale correctly (~9-12 mi)', () => {
            // Phoenix: 33.4484, -112.0740
            // Scottsdale: 33.4942, -111.9261
            const dist = distanceMiles(33.4484, -112.0740, 33.4942, -111.9261);
            expect(dist).toBeGreaterThan(9);
            expect(dist).toBeLessThan(12);
        });

        it('should calculate distance between Las Vegas and Los Angeles (~270 mi)', () => {
            const dist = distanceMiles(36.1699, -115.1398, 34.0522, -118.2437);
            expect(dist).toBeGreaterThan(200);
            expect(dist).toBeLessThan(300);
        });

        it('should calculate distance between New York and London (~3450 mi)', () => {
            const dist = distanceMiles(40.7128, -74.0060, 51.5074, -0.1278);
            expect(dist).toBeGreaterThan(3400);
            expect(dist).toBeLessThan(3500);
        });

        it('should be commutative (A→B = B→A)', () => {
            const distAB = distanceMiles(33.4484, -112.0740, 36.1699, -115.1398);
            const distBA = distanceMiles(36.1699, -115.1398, 33.4484, -112.0740);
            expect(distAB).toBeCloseTo(distBA, 10);
        });
    });

    describe('boundingBox', () => {
        it('should create a bounding box centered on the point', () => {
            const box = boundingBox(33.4484, -112.0740, 30);
            expect(box.minLat).toBeLessThan(33.4484);
            expect(box.maxLat).toBeGreaterThan(33.4484);
            expect(box.minLng).toBeLessThan(-112.0740);
            expect(box.maxLng).toBeGreaterThan(-112.0740);
        });

        it('should contain the center point', () => {
            const box = boundingBox(33.4484, -112.0740, 30);
            expect(33.4484).toBeGreaterThan(box.minLat);
            expect(33.4484).toBeLessThan(box.maxLat);
            expect(-112.0740).toBeGreaterThan(box.minLng);
            expect(-112.0740).toBeLessThan(box.maxLng);
        });

        it('should have a larger box for larger radius', () => {
            const small = boundingBox(33.4484, -112.0740, 10);
            const large = boundingBox(33.4484, -112.0740, 50);
            expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
            expect(large.maxLng - large.minLng).toBeGreaterThan(small.maxLng - small.minLng);
        });
    });
});
