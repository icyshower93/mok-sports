import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Database } from "lucide-react";

export default function DatabaseViewer() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Get table counts
  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ['/api/debug/database/counts']
  });

  // Get specific table data
  const { data: tableData, isLoading: loadingTable } = useQuery({
    queryKey: [`/api/debug/database/${selectedTable}`],
    enabled: !!selectedTable
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Database className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Database Viewer</h1>
      </div>

      {loadingCounts ? (
        <div className="text-center py-8">Loading database overview...</div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Table Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {counts && Object.entries(counts).map(([tableName, count]) => (
              <Card key={tableName} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {tableName}
                    <Badge variant="secondary">
                      {typeof count === 'string' ? 'Error' : count} rows
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedTable(tableName)}
                    className="w-full"
                  >
                    View Data
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedTable && (
            <Collapsible open={true} onOpenChange={() => setSelectedTable(null)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-lg">
                  <span>Data from: {selectedTable}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card>
                  <CardContent className="p-4">
                    {loadingTable ? (
                      <div className="text-center py-4">Loading {selectedTable} data...</div>
                    ) : tableData ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {tableData.count} rows in {selectedTable}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTable(null)}
                          >
                            Close
                          </Button>
                        </div>
                        
                        {tableData.data && tableData.data.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="border-b">
                                  {Object.keys(tableData.data[0]).map((key) => (
                                    <th key={key} className="text-left p-2 font-medium">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.data.map((row: any, index: number) => (
                                  <tr key={index} className="border-b hover:bg-muted/50">
                                    {Object.values(row).map((value: any, cellIndex: number) => (
                                      <td key={cellIndex} className="p-2 max-w-xs truncate">
                                        {value === null ? (
                                          <span className="text-muted-foreground italic">null</span>
                                        ) : typeof value === 'boolean' ? (
                                          value ? 'true' : 'false'
                                        ) : typeof value === 'object' ? (
                                          JSON.stringify(value)
                                        ) : (
                                          String(value)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            No data found in {selectedTable}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-red-500">
                        Failed to load {selectedTable} data
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}