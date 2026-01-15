/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { DrawioToSqlToolInvocation } from './drawio-to-sql-tool.js';
import type { Config } from '../config/config.js';

// Helper to access private method for testing
function extractDrawioStructure(
  invocation: DrawioToSqlToolInvocation,
  xml: string,
): {
  boxes: Array<{ id: string; text: string; children?: string[] }>;
  relationships: Array<{ source: string; target: string }>;
} {
  return invocation['extractDrawioStructure'](xml);
}

// Helper to access private method for testing decoding
async function decodeDrawio(
  invocation: DrawioToSqlToolInvocation,
  content: string,
): Promise<string> {
  return invocation['decodeDrawio'](content);
}

describe('DrawioToSqlTool', () => {
  // Mock Config
  const mockConfig = {
    getBaseLlmClient: vi.fn(),
    getActiveModel: vi.fn().mockReturnValue('mock-model'),
  } as unknown as Config;

  // Mock params for invocation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockParams = { filePath: 'test.drawio' } as any;
  const invocation = new DrawioToSqlToolInvocation(mockParams, mockConfig);

  it('should parse basic table structure with parent="1"', () => {
    const xml = `
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Users" style="swimlane" parent="1" vertex="1">
                    <mxGeometry x="40" y="40" width="200" height="200" as="geometry"/>
                </mxCell>
                <mxCell id="3" value="id: INT" parent="2" vertex="1">
                    <mxGeometry y="30" width="200" height="30" as="geometry"/>
                </mxCell>
                <mxCell id="4" value="name: VARCHAR" parent="2" vertex="1">
                    <mxGeometry y="60" width="200" height="30" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
        `;
    const result = extractDrawioStructure(invocation, xml);
    expect(result.boxes).toHaveLength(1);
    expect(result.boxes[0].text).toBe('Users');
    expect(result.boxes[0].children).toContain('id: INT');
    expect(result.boxes[0].children).toContain('name: VARCHAR');
  });

  it('should parse basic table structure on different layer (parent="2")', () => {
    const xml = `
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Layer 2" parent="1"/>
                <!-- Table on "Layer 2" (id="2") -->
                <mxCell id="3" value="Products" style="swimlane" parent="2" vertex="1"/>
                <mxCell id="4" value="id: INT" parent="3" vertex="1"/>
                <mxCell id="5" value="price: DECIMAL" parent="3" vertex="1"/>
            </root>
        </mxGraphModel>
        `;
    const result = extractDrawioStructure(invocation, xml);
    expect(result.boxes).toHaveLength(1);
    expect(result.boxes[0].text).toBe('Products');
    expect(result.boxes[0].children).toContain('price: DECIMAL');
  });

  it('should capture raw values for LLM processing', () => {
    const xml = `
             <mxCell id="2" value="Tags" style="swimlane" parent="1" vertex="1"/>
             <mxCell id="3" value="tag_name" parent="2" vertex="1"/>
        `;
    const result = extractDrawioStructure(invocation, xml);
    expect(result.boxes[0].text).toBe('Tags');
    expect(result.boxes[0].children).toContain('tag_name');
  });

  it('should handle HTML entities in values', () => {
    const xml = `
             <mxCell id="2" value="Orders" style="swimlane" parent="1" vertex="1"/>
             <mxCell id="3" value="customer_id: INT&nbsp;" parent="2" vertex="1"/>
             <mxCell id="4" value="status: &lt;Enum&gt;" parent="2" vertex="1"/>
        `;
    const result = extractDrawioStructure(invocation, xml);
    expect(result.boxes[0].children).toContain('customer_id: INT');
    expect(result.boxes[0].children).toContain('status: <Enum>');
  });

  it('should parse relationships from connection lines', () => {
    const xml = `
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                
                <mxCell id="2" value="Users" style="swimlane" parent="1" vertex="1"/>
                <mxCell id="3" value="id" parent="2" vertex="1"/>

                <mxCell id="5" value="Posts" style="swimlane" parent="1" vertex="1"/>
                <mxCell id="6" value="user_id" parent="5" vertex="1"/>
                <mxCell id="7" value="id" parent="5" vertex="1"/>

                <!-- Edge from Posts(5) to Users(2) -->
                <mxCell id="10" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="5" target="2">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
        `;

    const result = extractDrawioStructure(invocation, xml);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].source).toBe('Posts');
    expect(result.relationships[0].target).toBe('Users');
  });

  it('should capture Enum tables as boxes (LLM will filter)', () => {
    const xml = `
          <mxCell id="2" value="StatusEnum" style="swimlane;fillColor=#f5f5f5" parent="1" vertex="1"/>
          <mxCell id="3" value="ACTIVE" parent="2" vertex="1"/>
          <mxCell id="4" value="RealTable" style="swimlane" parent="1" vertex="1"/>
          <mxCell id="5" value="id" parent="4" vertex="1"/>
      `;
    const result = extractDrawioStructure(invocation, xml);
    // Both should be captured as boxes, LLM decides what to do with them
    expect(result.boxes.map((b) => b.text)).toContain('StatusEnum');
    expect(result.boxes.map((b) => b.text)).toContain('RealTable');
  });

  it('should handle compressed content (mocked)', async () => {
    const content = '<mxfile><diagram>some-xml-content</diagram></mxfile>';
    const decoded = await decodeDrawio(invocation, content);
    expect(decoded).toBe('some-xml-content');
  });
});
