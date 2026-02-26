#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import argparse
import json
import os
import socket
from urllib.parse import quote, urlparse
import requests
from pydantic import BaseModel, Field


# 定义请求体模型
class IcebergQueryParams(BaseModel):
    rest_uri: str = Field(..., description="Iceberg REST catalog base URI")
    warehouse: str = Field(..., description="Warehouse name")
    namespace: str = Field(..., description="Namespace name")
    table: str = Field(..., description="Table name")
    sql: str = Field(..., description="SQL query to execute")
    bearer_token: Optional[str] = Field(None, description="Bearer token for authentication")
    auth_type: str = Field("noop", description="Authentication type")
    credential: Optional[str] = Field(None, description="OAuth2 credential")
    oauth2_server_uri: Optional[str] = Field(None, description="OAuth2 server URI")
    access_delegation: Optional[str] = Field(None, description="Access delegation setting")
    gravitino_uri: Optional[str] = Field(None, description="Gravitino URI for storage properties")
    metalake: Optional[str] = Field(None, description="Gravitino metalake name")
    gravitino_catalog: Optional[str] = Field(None, description="Gravitino catalog name for storage properties")
    s3_endpoint: Optional[str] = Field(None, description="S3 endpoint")
    s3_access_key_id: Optional[str] = Field(None, description="S3 access key ID")
    s3_secret_access_key: Optional[str] = Field(None, description="S3 secret access key")
    s3_region: str = Field("us-east-1", description="S3 region", example="us-east-1")
    fetch_storage_from_gravitino: bool = Field(False, description="Fetch S3 storage properties from Gravitino")
    skip_endpoint_check: bool = Field(False, description="Skip endpoint connectivity check")
    endpoint_check_timeout: float = Field(3.0, description="Endpoint check timeout in seconds", ge=0)


class LanceQueryParams(BaseModel):
    gravitino_uri: str = Field(..., description="Gravitino unified API base URI")
    metalake: str = Field(..., description="Gravitino metalake name")
    catalog: str = Field(..., description="Gravitino catalog name")
    namespace: str = Field(..., description="Namespace name")
    table: str = Field(..., description="Table name")
    sql: str = Field(..., description="SQL to execute in DataFusion")
    skip_endpoint_check: bool = Field(False, description="Skip endpoint connectivity check")
    endpoint_check_timeout: float = Field(3.0, description="Endpoint check timeout in seconds", ge=0)

# Import from the existing scripts
from query_iceberg import (
    fetch_gravitino_catalog_properties,
    resolve_iceberg_rest_uri,
    create_rest_catalog,
    _table_identifier,
    _table_location_str,
    generate_random_arrow_table_from_iceberg_schema,
    query_with_datafusion_from_arrow,
    print_arrow_table_as_sql_result,
    _requires_s3_credentials,
    _has_env_s3_credentials,
    _preflight_endpoint
)
from query_lance import (
    GravitinoTableRef,
    fetch_gravitino_table,
    parse_lance_properties,
    extract_gravitino_columns,
    build_pyarrow_schema_from_columns,
    build_lance_storage_options_from_props,
    _preflight_s3_endpoint,
    query_with_datafusion as query_with_datafusion_lance
)

app = FastAPI(title="AI Query Service", description="Service to query Iceberg and Lance tables using SQL")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
GRAVITINO_ACCEPT = "application/vnd.gravitino.v1+json"

@app.get("/")
async def root():
    return {"message": "Welcome to AI Query Service"}

@app.post("/query/iceberg")
async def query_iceberg(params: IcebergQueryParams):
    """
    Query an Iceberg table via Iceberg REST catalog and DataFusion SQL
    """
    print(f"params: {params}")
    try:
        # 解包参数
        rest_uri = params.rest_uri
        warehouse = params.warehouse
        namespace = params.namespace
        table = params.table
        sql = params.sql
        bearer_token = params.bearer_token
        auth_type = params.auth_type
        credential = params.credential
        oauth2_server_uri = params.oauth2_server_uri
        access_delegation = params.access_delegation
        gravitino_uri = params.gravitino_uri
        metalake = params.metalake
        gravitino_catalog = params.gravitino_catalog
        s3_endpoint = params.s3_endpoint
        s3_access_key_id = params.s3_access_key_id
        s3_secret_access_key = params.s3_secret_access_key
        s3_region = params.s3_region
        fetch_storage_from_gravitino = params.fetch_storage_from_gravitino
        skip_endpoint_check = params.skip_endpoint_check
        endpoint_check_timeout = params.endpoint_check_timeout
        
        # Resolve REST URI
        resolved_rest_uri, warehouse_required = resolve_iceberg_rest_uri(rest_uri, timeout_s=endpoint_check_timeout)
        
        if warehouse_required and not warehouse:
            raise HTTPException(status_code=400, detail="This Iceberg REST endpoint requires a warehouse parameter")
        
        if not skip_endpoint_check:
            _preflight_endpoint(rest_uri, timeout_s=endpoint_check_timeout)
        
        # Build REST properties
        rest_props: Dict[str, Any] = {"uri": resolved_rest_uri}
        rest_props["auth"] = {"type": auth_type}
        
        if access_delegation:
            rest_props["header.X-Iceberg-Access-Delegation"] = str(access_delegation)
        
        if bearer_token:
            rest_props["header.Authorization"] = f"Bearer {bearer_token}"
        if credential:
            rest_props["credential"] = credential
        if oauth2_server_uri:
            rest_props["oauth2-server-uri"] = oauth2_server_uri
        
        if warehouse:
            rest_props["warehouse"] = warehouse
            
        # Fetch storage properties from Gravitino if requested
        if fetch_storage_from_gravitino and gravitino_uri and metalake and gravitino_catalog:
            g_props = fetch_gravitino_catalog_properties(
                gravitino_uri=gravitino_uri,
                metalake=metalake,
                catalog=gravitino_catalog,
                timeout_s=endpoint_check_timeout
            )
            s3_endpoint = s3_endpoint or g_props.get("s3-endpoint", "")
            s3_access_key_id = s3_access_key_id or g_props.get("s3-access-key-id", "")
            s3_secret_access_key = s3_secret_access_key or g_props.get("s3-secret-access-key", "")
            s3_region = g_props.get("s3-region", s3_region)
        
        # Add S3 properties if provided
        if s3_endpoint:
            rest_props["s3.endpoint"] = s3_endpoint
        if s3_access_key_id:
            rest_props["s3.access-key-id"] = s3_access_key_id
        if s3_secret_access_key:
            rest_props["s3.secret-access-key"] = s3_secret_access_key
        if s3_region:
            rest_props["s3.region"] = s3_region
        
        # Create catalog instance
        catalog = create_rest_catalog("rest_catalog", **rest_props)
        
        # Load table
        identifier = _table_identifier(namespace, table)
        iceberg_table = catalog.load_table(identifier)
        
        # Perform query
        arrow_scan_table = iceberg_table.scan().to_arrow()
        safe_table = table.replace('"', '""')
        result_table = query_with_datafusion_from_arrow(table, arrow_scan_table, sql)
        
        # Convert result to dict for JSON serialization
        result_dict = result_table.to_pydict()
        return {
            "status": "success",
            "query": sql,
            "result": result_dict,
            "row_count": result_table.num_rows
        }
        
    except Exception as e:
        print(f"Error executing Iceberg query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing Iceberg query: {str(e)}")


@app.post("/query/lance")
async def query_lance(params: LanceQueryParams):
    """
    Query a Lance table via Gravitino unified API and DataFusion SQL
    """
    print(f"params: {params}")
    try:
        # 解包参数
        gravitino_uri = params.gravitino_uri
        metalake = params.metalake
        catalog = params.catalog
        namespace = params.namespace
        table = params.table
        sql = params.sql
        skip_endpoint_check = params.skip_endpoint_check
        endpoint_check_timeout = params.endpoint_check_timeout
        
        # Create table reference
        ref = GravitinoTableRef(
            uri=gravitino_uri,
            metalake=metalake,
            catalog=catalog,
            schema=namespace,
            table=table,
        )
        
        # Fetch table metadata from Gravitino
        table_obj = fetch_gravitino_table(ref)
        
        # Extract columns
        columns = extract_gravitino_columns(table_obj)
        
        # Parse Lance properties
        location, props = parse_lance_properties(table_obj)
        
        # Build storage options
        storage_options = build_lance_storage_options_from_props(props)
        
        # Check endpoint if not skipped
        if not skip_endpoint_check:
            _preflight_s3_endpoint(storage_options, timeout_s=endpoint_check_timeout)
        
        # Execute query
        safe_table = table.replace('"', '""')
        sql_to_run = sql or f'SELECT * FROM "{safe_table}" LIMIT 10'
        sql_result, result_table = query_with_datafusion_lance(location, storage_options, table, sql=sql_to_run)
        
        # Convert result to dict for JSON serialization
        result_dict = result_table.to_pydict()
        
        return {
            "status": "success",
            "query": sql_result,
            "result": result_dict,
            "row_count": result_table.num_rows
        }
        
    except Exception as e:
        print(f"Error executing Lance query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing Lance query: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    parser = argparse.ArgumentParser(description="Run the AI Query Service")
    parser.add_argument(
        "--host",
        default=os.getenv("AI_QUERY_SERVICE_HOST", "0.0.0.0"),
        help="Host to bind to"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("AI_QUERY_SERVICE_PORT", "4008")),
        help="Port to bind to"
    )
    
    args = parser.parse_args()
    
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        #reload=True  # Set to False in production
    )